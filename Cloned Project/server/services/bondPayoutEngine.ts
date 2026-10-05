// The HiFi bond payout + redemption engine.
//
// ---------------------------------------------------------------
// Why this is written the way it is
// ---------------------------------------------------------------
// This backend has NO cron library and NO leader election — every job
// is a plain `setInterval` registered in src/index.ts. In a
// multi-instance deploy the same tick runs concurrently on every
// instance. Correctness therefore does NOT come from scheduling; it
// comes from:
//
//   1. Every payout event row existing BEFORE any money moves, created
//      at purchase time with a unique `dedupeKey` (spec §8).
//   2. A conditional claim (`findOneAndUpdate` on status "scheduled")
//      so exactly one worker can take an event.
//   3. Each event settling inside its own transaction, so one failure
//      never cascades to another holding.
//
// The engine is LIVE on deploy — no env flag, nothing to configure.
// That is safe by construction rather than by luck: the tick only ever
// acts on `bond_payout_events`, and those rows exist only once a
// founder has published a bond AND an investor has bought it. With no
// instruments, every tick is a no-op.

import mongoose from "mongoose";
import { BondHolding } from "../models/bondHolding.model";
import { BondPayoutEvent } from "../models/bondPayoutEvent.model";
import { BondInstrument } from "../models/bondInstrument.model";
import { BondLedgerEntry } from "../models/bondLedgerEntry.model";
import { StoreWallet } from "../models/storeWallet.model";
import { WalletTransaction } from "../models/walletTransaction.model";
import { BondCurrency, toWalletAmount, fromAtomic } from "../config/bondMoney";
import { findOrgFounderId } from "./hifiInvoiceFulfillment";

/**
 * Spec §8 wants "a defined number of attempts", not open-ended retry.
 * Hardcoded rather than env-driven so a deploy needs no configuration
 * and every environment behaves identically.
 */
export const BOND_PAYOUT_MAX_ATTEMPTS = 5;
/** Backoff per attempt number (spec §8 wants a DEFINED number of tries). */
const RETRY_BACKOFF_MS = [
  60 * 60 * 1000, // 1h
  6 * 60 * 60 * 1000, // 6h
  24 * 60 * 60 * 1000,
  24 * 60 * 60 * 1000,
  24 * 60 * 60 * 1000,
];



export interface TickResult {
  due: number;
  paid: number;
  failed: number;
  exhausted: number;
  redeemed: number;
  errors: string[];
}

/**
 * Move funds founder -> buyer inside the caller's transaction, writing
 * both the WalletTransaction and the bond ledger rows.
 *
 * Returns null when the founder cannot cover it — the caller decides
 * whether that is a retryable payout failure or a blocked redemption.
 * Deliberately does NOT throw for insufficient funds: that is an
 * expected state under decision D5 (no escrow), not an exception.
 */
async function transferFounderToBuyer(
  opts: {
    orgId: any;
    founderUserId: string;
    buyerUserId: any;
    currency: BondCurrency;
    amountAtomic: string;
    description: string;
    metadataKind: string;
    extraMetadata?: Record<string, any>;
  },
  session: mongoose.ClientSession,
): Promise<{ debitTxId: any; creditTxId: any } | null> {
  const amount = toWalletAmount(opts.amountAtomic, opts.currency);

  const founderWallet: any = await StoreWallet.findOne({
    userId: opts.founderUserId,
    orgId: opts.orgId,
    currency: opts.currency,
  }).session(session);

  if (!founderWallet || founderWallet.balance < amount) {
    return null;
  }

  const fBefore = founderWallet.balance;
  founderWallet.balance = fBefore - amount;
  founderWallet.lastTransactionAt = new Date();
  await founderWallet.save({ session });

  const [debitTx] = await WalletTransaction.create(
    [
      {
        storeWalletId: founderWallet._id,
        walletType: "store",
        userId: opts.founderUserId,
        orgId: opts.orgId,
        type: "debit",
        amount,
        currency: opts.currency,
        balanceBefore: fBefore,
        balanceAfter: founderWallet.balance,
        description: opts.description,
        relatedUserId: opts.buyerUserId,
        status: "completed",
        metadata: { kind: `${opts.metadataKind}_debit`, ...(opts.extraMetadata || {}) },
      },
    ],
    { session },
  );

  let buyerWallet: any = await StoreWallet.findOne({
    userId: opts.buyerUserId,
    orgId: opts.orgId,
    currency: opts.currency,
  }).session(session);
  if (!buyerWallet) {
    const [w] = await StoreWallet.create(
      [
        {
          userId: opts.buyerUserId,
          orgId: opts.orgId,
          currency: opts.currency,
          balance: 0,
          isActive: true,
        },
      ],
      { session },
    );
    buyerWallet = w;
  }
  const bBefore = buyerWallet.balance;
  buyerWallet.balance = bBefore + amount;
  buyerWallet.lastTransactionAt = new Date();
  await buyerWallet.save({ session });

  const [creditTx] = await WalletTransaction.create(
    [
      {
        storeWalletId: buyerWallet._id,
        walletType: "store",
        userId: opts.buyerUserId,
        orgId: opts.orgId,
        type: "credit",
        amount,
        currency: opts.currency,
        balanceBefore: bBefore,
        balanceAfter: buyerWallet.balance,
        description: opts.description,
        relatedUserId: opts.founderUserId,
        status: "completed",
        metadata: { kind: `${opts.metadataKind}_credit`, ...(opts.extraMetadata || {}) },
      },
    ],
    { session },
  );

  return { debitTxId: debitTx._id, creditTxId: creditTx._id };
}

/** Settle one due payout event. Own transaction. */
async function settleEvent(ev: any): Promise<"paid" | "failed" | "exhausted"> {
  const founderUserId = await findOrgFounderId(ev.orgId);
  if (!founderUserId) {
    await BondPayoutEvent.updateOne(
      { _id: ev._id },
      { $set: { status: "scheduled", lastError: "no founder for org" }, $inc: { attempts: 1 } },
    );
    return "failed";
  }

  const instrument: any = await BondInstrument.findById(ev.instrumentId)
    .select("combPlanId name")
    .lean();

  // FX quote for the payout-leg commission happens OUTSIDE the
  // transaction — it is a network call.
  let poolQuote = { poolUsd: 0, fxRateToUsd: 0 };
  if (ev.commissionAtomic && ev.commissionAtomic !== "0") {
    const { quoteBondCommissionUsd } = await import("./bondCommission");
    poolQuote = await quoteBondCommissionUsd(ev.commissionAtomic, ev.currency);
  }

  // USD value of this payment at the moment it is paid, for the public
  // bond page. Network call, so outside the transaction — and wrapped so
  // a dead price feed can NEVER block an investor's payout. A miss just
  // leaves the field null.
  let usdAtPayment: number | null = null;
  let usdRateAtPayment: number | null = null;
  try {
    const amountWhole = Number(fromAtomic(ev.interestAtomic, ev.currency));
    if (ev.currency === "USD") {
      usdAtPayment = amountWhole;
      usdRateAtPayment = 1;
    } else {
      const { convertBetween } = await import("./cryptoFxRate");
      const q = await convertBetween(amountWhole, ev.currency as any, "USD");
      usdAtPayment = Math.round(q.converted * 100) / 100;
      usdRateAtPayment = amountWhole > 0 ? q.converted / amountWhole : null;
    }
  } catch {
    // Feed unavailable — pay anyway, record no USD.
  }

  const session = await mongoose.startSession();
  let deferredUp: import("./bondCommission").DeferredUpPayout | undefined;
  try {
    let outcome: "paid" | "failed" | "exhausted" = "failed";
    await session.withTransaction(async () => {
      const moved = await transferFounderToBuyer(
        {
          orgId: ev.orgId,
          founderUserId,
          buyerUserId: ev.buyerUserId,
          currency: ev.currency,
          amountAtomic: ev.interestAtomic,
          description: `Bond interest — payout ${ev.sequenceNo}`,
          metadataKind: "bond_payout",
          extraMetadata: {
            bondInstrumentId: String(ev.instrumentId),
            bondHoldingId: String(ev.holdingId),
            bondPayoutEventId: String(ev._id),
            sequenceNo: ev.sequenceNo,
          },
        },
        session,
      );

      if (!moved) {
        const attempts = (ev.attempts || 0) + 1;
        const done = attempts >= BOND_PAYOUT_MAX_ATTEMPTS;
        await BondPayoutEvent.updateOne(
          { _id: ev._id },
          {
            $set: {
              status: done ? "failed" : "scheduled",
              attempts,
              lastError: "Founder wallet has insufficient balance",
              ...(done
                ? {}
                : {
                    dueAt: new Date(
                      Date.now() +
                        (RETRY_BACKOFF_MS[attempts - 1] ??
                          RETRY_BACKOFF_MS[RETRY_BACKOFF_MS.length - 1]),
                    ),
                  }),
            },
          },
          { session },
        );
        await BondHolding.updateOne(
          { _id: ev.holdingId },
          {
            $set: {
              status: "payout_failed",
              lastPayoutError: "Founder wallet has insufficient balance",
            },
          },
          { session },
        );
        outcome = done ? "exhausted" : "failed";
        return;
      }

      await BondLedgerEntry.create(
        [
          {
            kind: "payout_credit",
            instrumentId: ev.instrumentId,
            holdingId: ev.holdingId,
            payoutEventId: ev._id,
            orgId: ev.orgId,
            fromUserId: founderUserId,
            toUserId: ev.buyerUserId,
            currency: ev.currency,
            amountAtomic: ev.interestAtomic,
            walletAmount: toWalletAmount(ev.interestAtomic, ev.currency),
            walletTransactionId: moved.creditTxId,
            note: `Payout ${ev.sequenceNo} of ${ev.currency} bond`,
          },
        ],
        { session },
      );

      if (ev.commissionAtomic && ev.commissionAtomic !== "0") {
        const { distributeBondCommission } = await import("./bondCommission");
        const commissionRes = await distributeBondCommission({
          poolAtomic: ev.commissionAtomic,
          poolUsd: poolQuote.poolUsd,
          fxRateToUsd: poolQuote.fxRateToUsd,
          currency: ev.currency,
          buyerId: String(ev.buyerUserId),
          combPlanId: instrument?.combPlanId,
          orgId: ev.orgId,
          instrumentId: ev.instrumentId,
          holdingId: ev.holdingId,
          payoutEventId: ev._id,
          paymentId: `bond_payout_${ev._id}`,
          kind: "payout_commission",
          session,
        });
        deferredUp = commissionRes.deferred;
      }

      await BondPayoutEvent.updateOne(
        { _id: ev._id },
        {
          $set: {
            status: "paid",
            paidAt: new Date(),
            walletTransactionId: moved.creditTxId,
            lastError: null,
            usdAtPayment,
            usdRateAtPayment,
          },
          $inc: { attempts: 1 },
        },
        { session },
      );

      const nextEv = await BondPayoutEvent.findOne({
        holdingId: ev.holdingId,
        status: "scheduled",
        _id: { $ne: ev._id },
      })
        .sort({ dueAt: 1 })
        .select("dueAt")
        .session(session)
        .lean();

      await BondHolding.updateOne(
        { _id: ev.holdingId },
        {
          $set: {
            status: "active",
            lastPayoutError: null,
            nextPayoutAt: nextEv?.dueAt || null,
          },
          $inc: { payoutsCompleted: 1 },
        },
        { session },
      );

      outcome = "paid";
    });
    // Post-commit: the payout itself is final. A commission failure
    // must not mark the payout failed and retry the whole thing.
    // Widened deliberately: `outcome` is assigned inside the
    // withTransaction callback, which TypeScript's control-flow
    // analysis cannot see, so it narrows the literal type to "failed"
    // and rejects the comparison.
    const settled: string = outcome;
    if (settled === "paid" && deferredUp) {
      try {
        const { runDeferredUpPayout } = await import("./bondCommission");
        await runDeferredUpPayout(deferredUp);
      } catch (err) {
        console.error(
          `[BondPayouts] payout commission FAILED for event ${ev._id} — ` +
            `replay with paymentId ${deferredUp.paymentId}:`,
          (err as Error)?.message || err,
        );
      }
    }
    return outcome;
  } finally {
    session.endSession();
  }
}

/**
 * Return principal and close the holding. Shared by the investor's
 * manual Redeem and the auto-redeem sweep (decision D8).
 *
 * Refuses while any payout is still outstanding — returning principal
 * with interest still owed would strand the buyer.
 */
export async function redeemHolding(
  holdingId: string,
  opts: { auto: boolean },
): Promise<{ ok: boolean; reason?: string; amountAtomic?: string }> {
  const holding: any = await BondHolding.findById(holdingId);
  if (!holding) return { ok: false, reason: "not_found" };
  if (holding.status === "redeemed") return { ok: true, amountAtomic: holding.principalAtomic };
  if (holding.status === "cancelled") return { ok: false, reason: "cancelled" };

  if (!holding.maturesAt || holding.maturesAt.getTime() > Date.now()) {
    // Early redemption is not supported in v1 — it would require
    // forfeiture rules and commission clawback across the upline.
    return { ok: false, reason: "not_matured" };
  }

  const outstanding = await BondPayoutEvent.countDocuments({
    holdingId: holding._id,
    status: { $in: ["scheduled", "failed"] },
  });
  if (outstanding > 0) {
    return { ok: false, reason: "payouts_outstanding" };
  }

  const founderUserId = await findOrgFounderId(holding.orgId);
  if (!founderUserId) return { ok: false, reason: "no_founder" };

  const session = await mongoose.startSession();
  try {
    let result: { ok: boolean; reason?: string; amountAtomic?: string } = {
      ok: false,
      reason: "unknown",
    };
    await session.withTransaction(async () => {
      const fresh: any = await BondHolding.findOneAndUpdate(
        { _id: holding._id, status: { $in: ["active", "matured", "payout_failed"] } },
        { $set: { status: "matured" } },
        { new: true, session },
      );
      if (!fresh) {
        result = { ok: true, amountAtomic: holding.principalAtomic }; // already handled
        return;
      }

      const moved = await transferFounderToBuyer(
        {
          orgId: holding.orgId,
          founderUserId,
          buyerUserId: holding.buyerUserId,
          currency: holding.currency,
          amountAtomic: holding.principalAtomic,
          description: "Bond principal redemption",
          metadataKind: "bond_redemption",
          extraMetadata: {
            bondInstrumentId: String(holding.instrumentId),
            bondHoldingId: String(holding._id),
          },
        },
        session,
      );
      if (!moved) {
        result = { ok: false, reason: "insufficient_founder_balance" };
        throw new Error("ROLLBACK_INSUFFICIENT");
      }

      await BondLedgerEntry.create(
        [
          {
            kind: "redemption_credit",
            instrumentId: holding.instrumentId,
            holdingId: holding._id,
            orgId: holding.orgId,
            fromUserId: founderUserId,
            toUserId: holding.buyerUserId,
            currency: holding.currency,
            amountAtomic: holding.principalAtomic,
            walletAmount: toWalletAmount(holding.principalAtomic, holding.currency),
            walletTransactionId: moved.creditTxId,
            note: opts.auto ? "Auto-redeemed at maturity" : "Redeemed by investor",
          },
        ],
        { session },
      );

      await BondHolding.updateOne(
        { _id: holding._id },
        {
          $set: {
            status: "redeemed",
            redeemedAt: new Date(),
            redemptionTxId: moved.creditTxId,
            autoRedeemed: opts.auto,
            nextPayoutAt: null,
          },
        },
        { session },
      );

      result = { ok: true, amountAtomic: holding.principalAtomic };
    });
    return result;
  } catch (err: any) {
    if (err?.message === "ROLLBACK_INSUFFICIENT") {
      return { ok: false, reason: "insufficient_founder_balance" };
    }
    throw err;
  } finally {
    session.endSession();
  }
}

/**
 * One scheduler pass. Safe to run concurrently on several instances:
 * each event is claimed with a conditional update before any money is
 * touched.
 */
export async function runBondPayoutTick(
  opts: { batchSize?: number } = {},
): Promise<TickResult> {
  const batchSize = opts.batchSize ?? 200;
  const out: TickResult = {
    due: 0,
    paid: 0,
    failed: 0,
    exhausted: 0,
    redeemed: 0,
    errors: [],
  };

  const due = await BondPayoutEvent.find({
    status: "scheduled",
    dueAt: { $lte: new Date() },
  })
    .sort({ dueAt: 1 })
    .limit(batchSize)
    .lean();
  out.due = due.length;

  for (const ev of due) {
    // Claim it. Loser of a concurrent race gets null and skips.
    const claimed = await BondPayoutEvent.findOneAndUpdate(
      { _id: (ev as any)._id, status: "scheduled" },
      { $set: { status: "scheduled" }, $currentDate: { updatedAt: true } },
      { new: true },
    ).lean();
    if (!claimed) continue;

    try {
      const r = await settleEvent(claimed);
      if (r === "paid") out.paid++;
      else if (r === "exhausted") out.exhausted++;
      else out.failed++;
    } catch (err: any) {
      out.failed++;
      out.errors.push(`event ${(ev as any)._id}: ${err?.message || err}`);
    }
  }

  // Auto-redeem (decision D8): matured holdings with every payout done.
  const maturedHoldings = await BondHolding.find({
    status: { $in: ["active", "matured"] },
    maturesAt: { $lte: new Date() },
  })
    .limit(batchSize)
    .select("_id")
    .lean();

  for (const h of maturedHoldings) {
    try {
      const r = await redeemHolding(String((h as any)._id), { auto: true });
      if (r.ok) out.redeemed++;
    } catch (err: any) {
      out.errors.push(`redeem ${(h as any)._id}: ${err?.message || err}`);
    }
  }

  return out;
}
