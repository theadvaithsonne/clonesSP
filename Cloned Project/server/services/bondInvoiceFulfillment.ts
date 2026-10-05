// Fulfillment for the "hifi_bond" invoice itemType.
//
// By the time this runs the buyer's store wallet has already been
// debited by the invoice pay path. This hook turns that payment into a
// live position:
//
//   1. Creates the bond_holding (one per invoice, DB-enforced).
//   2. Pre-creates EVERY scheduled payout event, before any money is
//      ever moved for them. Spec §8 — the ledger row has to exist
//      first, so a retrying scheduler can never double-pay.
//   3. Passes the principal through to the founder's wallet
//      (decision D5 — no escrow; the founder can spend it, which is
//      why the payout engine has a payout_failed state).
//   4. Records the principal-commission POOL owed, if any.
//   5. Advances unitsSold and closes the instrument at cap.
//
// Idempotent throughout: re-entry from a retry or a reconcile sweep
// returns `already_fulfilled` rather than doubling anything.

import mongoose, { Types } from "mongoose";
import { Invoice } from "../models/invoice.model";
import { BondInstrument } from "../models/bondInstrument.model";
import { BondHolding } from "../models/bondHolding.model";
import { BondPayoutEvent } from "../models/bondPayoutEvent.model";
import { BondLedgerEntry } from "../models/bondLedgerEntry.model";
import { StoreWallet } from "../models/storeWallet.model";
import { WalletTransaction } from "../models/walletTransaction.model";
import { BondCurrency, mulUnits, percentOf, toWalletAmount } from "../config/bondMoney";
import { PAYOUT_PERIOD_DAYS, PayoutFrequency } from "./bondMath";
import { findOrgFounderId } from "./hifiInvoiceFulfillment";
import { generateBondHash } from "./bondHash";

export interface BondFulfillmentResult {
  status:
    | "fulfilled"
    | "already_fulfilled"
    | "missing_instrument"
    | "missing_founder"
    | "bad_metadata";
  holdingId?: string;
  payoutEventsCreated?: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Nth payout date = purchase date + N whole periods. */
export function payoutDueAt(
  purchasedAt: Date,
  sequenceNo: number,
  frequency: PayoutFrequency,
): Date {
  return new Date(
    purchasedAt.getTime() + sequenceNo * PAYOUT_PERIOD_DAYS[frequency] * DAY_MS,
  );
}

export async function fulfillBondInvoice(
  invoice: any,
): Promise<BondFulfillmentResult> {
  const md = invoice?.metadata || {};
  const instrumentId = md.bondInstrumentId;
  const units = Number(md.bondUnits);

  if (!instrumentId || !Number.isInteger(units) || units < 1) {
    console.error(
      `[bondFulfillment] invoice ${invoice?._id} missing bondInstrumentId/bondUnits`,
    );
    return { status: "bad_metadata" };
  }

  // Cheap idempotency check before doing any work.
  const existing = await BondHolding.findOne({ invoiceId: invoice._id })
    .select("_id")
    .lean();
  if (existing) {
    return { status: "already_fulfilled", holdingId: String(existing._id) };
  }

  const instrument: any = await BondInstrument.findById(instrumentId);
  if (!instrument) {
    console.error(`[bondFulfillment] instrument ${instrumentId} not found`);
    return { status: "missing_instrument" };
  }

  const currency = instrument.currency as BondCurrency;
  const orgId = instrument.orgId;
  const buyerUserId = invoice.userId;

  const founderUserId = await findOrgFounderId(orgId);
  if (!founderUserId) {
    console.error(
      `[bondFulfillment] no founder for org ${orgId} — cannot route principal`,
    );
    return { status: "missing_founder" };
  }

  // Snapshot the per-unit figures so a later instrument edit cannot
  // change what this holding is owed.
  const perUnitPayout = instrument.derived.payoutAmountPerUnitAtomic as string;
  const payoutCount = instrument.derived.payoutCount as number;
  const principalAtomic = mulUnits(instrument.unitPriceAtomic, units);
  const interestPerEventAtomic = mulUnits(perUnitPayout, units);

  const purchasedAt = invoice.paidAt ? new Date(invoice.paidAt) : new Date();
  const maturesAt = new Date(
    purchasedAt.getTime() + instrument.durationDays * DAY_MS,
  );

  // Commission pool owed on the principal leg (spec §6). "none" and
  // "payout" bases contribute nothing here.
  const chargesPrincipal =
    instrument.commissionBasis === "principal" ||
    instrument.commissionBasis === "both";
  const principalCommissionAtomic = chargesPrincipal
    ? mulUnits(
        percentOf(instrument.unitPriceAtomic, instrument.principalCommissionRate),
        units,
      )
    : "0";

  // Per-payout commission, stamped onto each event now so the payout
  // engine never has to re-derive it from a mutable instrument.
  const chargesPayout =
    instrument.commissionBasis === "payout" ||
    instrument.commissionBasis === "both";
  const commissionPerEventAtomic = chargesPayout
    ? mulUnits(
        percentOf(perUnitPayout, instrument.payoutCommissionRate),
        units,
      )
    : "0";

  // FX lookup BEFORE the transaction — convertBetween hits the network
  // and a long-running transaction holding locks on a rate call is a
  // good way to produce write conflicts under load.
  const { quoteBondCommissionUsd, distributeBondCommission } = await import(
    "./bondCommission"
  );
  const principalPoolQuote = await quoteBondCommissionUsd(
    principalCommissionAtomic,
    currency,
  );

  let holdingId: string;
  let created = 0;
  // Unilevel payouts cannot join our transaction (the engine owns its
  // own). Captured here, run after commit.
  let deferredUp: import("./bondCommission").DeferredUpPayout | undefined;

  // The bond hash is chosen here, outside the transaction, so a retry
  // after a collision can pick a fresh one. See the loop's catch.
  let bondHash = generateBondHash();
  for (let attempt = 0; ; attempt++) {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const [holding] = await BondHolding.create(
        [
          {
            instrumentId: instrument._id,
            bondHash,
            buyerUserId,
            orgId,
            units,
            currency,
            principalAtomic,
            payoutAmountPerUnitAtomic: perUnitPayout,
            payoutCount,
            invoiceId: invoice._id,
            status: "active",
            purchasedAt,
            maturesAt,
            nextPayoutAt:
              payoutCount > 0
                ? payoutDueAt(purchasedAt, 1, instrument.payoutFrequency)
                : null,
          },
        ],
        { session },
      );
      holdingId = String(holding._id);

      // Every payout event, up front. This is the spec §8 requirement:
      // a written row before any wallet call.
      if (payoutCount > 0) {
        const events = Array.from({ length: payoutCount }, (_, i) => {
          const sequenceNo = i + 1;
          return {
            holdingId: holding._id,
            instrumentId: instrument._id,
            orgId,
            buyerUserId,
            sequenceNo,
            dueAt: payoutDueAt(purchasedAt, sequenceNo, instrument.payoutFrequency),
            currency,
            interestAtomic: interestPerEventAtomic,
            commissionAtomic: commissionPerEventAtomic,
            status: "scheduled" as const,
            dedupeKey: `bond_payout_${holding._id}_${sequenceNo}`,
          };
        });
        const inserted = await BondPayoutEvent.insertMany(events, { session });
        created = inserted.length;
      }

      // D5 — principal passes through to the founder's spendable wallet.
      const walletAmount = toWalletAmount(principalAtomic, currency);
      let founderWallet: any = await StoreWallet.findOne({
        userId: founderUserId,
        orgId,
        currency,
      }).session(session);
      if (!founderWallet) {
        const [w] = await StoreWallet.create(
          [{ userId: founderUserId, orgId, currency, balance: 0, isActive: true }],
          { session },
        );
        founderWallet = w;
      }
      const before = founderWallet.balance;
      founderWallet.balance = before + walletAmount;
      founderWallet.lastTransactionAt = new Date();
      await founderWallet.save({ session });

      const [tx] = await WalletTransaction.create(
        [
          {
            storeWalletId: founderWallet._id,
            walletType: "store",
            userId: founderUserId,
            orgId,
            type: "credit",
            amount: walletAmount,
            currency,
            balanceBefore: before,
            balanceAfter: founderWallet.balance,
            description: `Bond principal — ${instrument.name}`,
            note: `${units} unit(s) of ${instrument.name}`,
            relatedUserId: buyerUserId,
            status: "completed",
            metadata: {
              kind: "bond_principal_credit",
              bondInstrumentId: String(instrument._id),
              bondHoldingId: holdingId,
              invoiceId: String(invoice._id),
              dedupeKey: `bond_principal_${invoice._id}`,
            },
          },
        ],
        { session },
      );

      await BondLedgerEntry.create(
        [
          {
            kind: "purchase_credit",
            instrumentId: instrument._id,
            holdingId: holding._id,
            orgId,
            fromUserId: buyerUserId,
            toUserId: founderUserId,
            currency,
            amountAtomic: principalAtomic,
            walletAmount,
            walletTransactionId: tx._id,
            note: `Principal for ${units} unit(s)`,
          },
        ],
        { session },
      );

      // Principal-leg commission (spec §6). The pool is converted to USD
      // at this boundary and handed to the founder's comp plan; the bond
      // engine never decides who gets paid. Writes its own ledger row.
      if (principalCommissionAtomic !== "0") {
        const commissionRes = await distributeBondCommission({
          poolAtomic: principalCommissionAtomic,
          poolUsd: principalPoolQuote.poolUsd,
          fxRateToUsd: principalPoolQuote.fxRateToUsd,
          currency,
          buyerId: String(buyerUserId),
          combPlanId: instrument.combPlanId,
          orgId,
          instrumentId: instrument._id,
          holdingId: holding._id,
          paymentId: `bond_principal_${invoice._id}`,
          kind: "principal_commission",
          session,
        });
        deferredUp = commissionRes.deferred;
      }

      // Advance supply and close at cap.
      const sold = (instrument.unitsSold || 0) + units;
      await BondInstrument.updateOne(
        { _id: instrument._id },
        {
          $set: {
            unitsSold: sold,
            ...(sold >= instrument.totalUnits
              ? { status: "fully_subscribed" }
              : {}),
          },
        },
        { session },
      );

      await Invoice.updateOne(
        { _id: invoice._id },
        { $set: { "metadata.bondFulfilledAt": new Date(), "metadata.bondHoldingId": holdingId } },
        { session },
      );
    });
    break; // committed
  } catch (err: any) {
    if (err?.code === 11000) {
      // Two different unique indexes can fire here, and they mean
      // opposite things — telling them apart matters, because the
      // buyer has ALREADY been debited by the time we run:
      //
      //   • bondHash collision — a fresh random id happened to match an
      //     existing one. Nothing was written (the transaction rolled
      //     back). Pick a new hash and go again. Treating this as
      //     "already fulfilled" would leave a debited buyer with no
      //     holding.
      //   • invoiceId — this invoice really was fulfilled already
      //     (concurrent retry / reconcile sweep). Idempotent no-op.
      const isHashCollision =
        !!err?.keyPattern?.bondHash || /bondHash/.test(String(err?.message || ""));
      if (isHashCollision && attempt < 3) {
        bondHash = generateBondHash();
        continue;
      }
      if (!isHashCollision) {
        const dupe = await BondHolding.findOne({ invoiceId: invoice._id })
          .select("_id")
          .lean();
        return { status: "already_fulfilled", holdingId: dupe ? String(dupe._id) : undefined };
      }
    }
    throw err;
  } finally {
    session.endSession();
  }
  }

  // Post-commit: the holding exists and is final, so a commission
  // failure here must not undo the purchase. Logged and replayable.
  if (deferredUp) {
    try {
      const { runDeferredUpPayout } = await import("./bondCommission");
      const r = await runDeferredUpPayout(deferredUp);
      console.log(
        `[bondFulfillment] principal commission: ${r.recipients} recipient(s), ` +
          `${r.unspentUsd} USD unspent`,
      );
    } catch (err) {
      console.error(
        `[bondFulfillment] PRINCIPAL COMMISSION FAILED for holding ${holdingId!} — ` +
          `replay with paymentId ${deferredUp.paymentId}:`,
        (err as Error)?.message || err,
      );
    }
  }

  console.log(
    `[bondFulfillment] invoice ${invoice.invoiceNumber} -> holding ${holdingId!} ` +
      `(${units} unit(s), ${payoutCount} payout(s) scheduled, principal ${principalAtomic} ${currency})`,
  );
  return { status: "fulfilled", holdingId: holdingId!, payoutEventsCreated: created };
}
