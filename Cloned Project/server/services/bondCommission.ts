// Commission for HiFi bonds.
//
// The bond engine never decides WHO gets paid — spec §6: "The bond
// engine does not know how commission is split. It computes a pool
// amount and calls the comp-plan service." This module is that call.
//
// ---------------------------------------------------------------
// Why the pool is converted to USD first
// ---------------------------------------------------------------
// A bond may be denominated in INR/USD/ETH/BTC/USDT (decision D4), but
// commission distribution across this platform is USD-only and rather
// firmly so:
//
//   • `distributeCommissions` calls `convertToUsd`, which supports ONLY
//     USD and INR and throws on anything else.
//   • `distributeUnilevelPlusCommission` accepts a `currency` argument,
//     stores it on the distribution row, and then hard-codes
//     currency:"USD" on all six of its credit paths.
//
// Rather than parameterise two engines with ~28 callers between them,
// the conversion happens HERE, at the bond boundary, using
// `cryptoFxRate.convertBetween` — which already supports every bond
// currency. Affiliates are therefore paid in USD, exactly as they are
// for every other product on the platform, and the engines are
// untouched.
//
// The FX rate used is stamped on the ledger row, because a
// crypto-denominated bond pays the investor a fixed amount in its own
// currency while the affiliate's USD value moves with the market.

import mongoose from "mongoose";
import { BondCurrency, fromAtomic } from "../config/bondMoney";
import { BondLedgerEntry } from "../models/bondLedgerEntry.model";
import { CombPlan } from "../models/combPlan.model";

export interface PoolQuote {
  poolUsd: number;
  fxRateToUsd: number;
}

/**
 * Convert a commission pool to USD. Does network IO (rate lookup), so
 * call it BEFORE opening a mongo transaction — never inside one.
 */
export async function quoteBondCommissionUsd(
  poolAtomic: string,
  currency: BondCurrency,
): Promise<PoolQuote> {
  if (poolAtomic === "0") return { poolUsd: 0, fxRateToUsd: 0 };
  const amount = Number(fromAtomic(poolAtomic, currency));
  if (currency === "USD") return { poolUsd: amount, fxRateToUsd: 1 };

  const { convertBetween } = await import("./cryptoFxRate");
  const { converted, rate } = await convertBetween(amount, currency, "USD");
  return { poolUsd: converted, fxRateToUsd: rate };
}

export interface DistributeBondCommissionInput {
  poolAtomic: string;
  poolUsd: number;
  fxRateToUsd: number;
  currency: BondCurrency;
  buyerId: string;
  combPlanId: any;
  orgId: any;
  instrumentId: any;
  holdingId: any;
  payoutEventId?: any;
  /** Stable per pool — the engines dedupe on this. */
  paymentId: string;
  /** "principal_commission" at purchase, "payout_commission" per payout. */
  kind: "principal_commission" | "payout_commission";
  session: mongoose.ClientSession;
}

export interface DeferredUpPayout {
  planId: string;
  buyerId: string;
  poolUsd: number;
  paymentId: string;
  metadata: Record<string, any>;
}

export interface DistributeBondCommissionResult {
  distributed: boolean;
  planKind?: "levels" | "unilevel_plus";
  recipients: { userId: string; amountUsd: number; level?: number }[];
  unallocatedUsd: number;
  reason?: string;
  /**
   * Set when the plan is `unilevel_plus`. The caller MUST run this
   * after its transaction commits — see `runDeferredUpPayout`.
   */
  deferred?: DeferredUpPayout;
}

/**
 * Split a bond commission pool through the founder's chosen comp plan.
 *
 * `levels`        — the founder enters a percentage per level and the
 *                   total must match the bond's commission rate. Each
 *                   level therefore takes its share OF THE POOL, split
 *                   proportionally so the arithmetic still holds if the
 *                   entered total drifts from the rate.
 * `unilevel_plus` — the founder enters one percentage; the whole pool
 *                   goes to the Unilevel Plus engine, which owns the
 *                   rest of the logic.
 *
 * Must run inside the caller's transaction so a failed split rolls back
 * with the money movement that produced it.
 */
export async function distributeBondCommission(
  input: DistributeBondCommissionInput,
): Promise<DistributeBondCommissionResult> {
  const {
    poolAtomic,
    poolUsd,
    fxRateToUsd,
    currency,
    buyerId,
    combPlanId,
    orgId,
    instrumentId,
    holdingId,
    payoutEventId,
    paymentId,
    kind,
    session,
  } = input;

  const recipients: { userId: string; amountUsd: number; level?: number }[] = [];

  if (poolAtomic === "0" || poolUsd <= 0) {
    return { distributed: false, recipients, unallocatedUsd: 0, reason: "empty_pool" };
  }
  if (!combPlanId) {
    // No plan attached: the pool stays with the founder. Recorded so the
    // obligation is visible rather than silently vanishing.
    await writeLedger(input, 0, "no_comb_plan", session);
    return { distributed: false, recipients, unallocatedUsd: poolUsd, reason: "no_comb_plan" };
  }

  const plan: any = await CombPlan.findById(combPlanId).session(session).lean();
  if (!plan || plan.isActive === false) {
    await writeLedger(input, 0, "plan_missing_or_inactive", session);
    return {
      distributed: false,
      recipients,
      unallocatedUsd: poolUsd,
      reason: "plan_missing_or_inactive",
    };
  }

  const { creditAffiliateOrPlatform } = await import("./wallet");
  let planKind: "levels" | "unilevel_plus" =
    plan.planKind === "unilevel_plus" ? "unilevel_plus" : "levels";
  let unallocatedUsd = 0;

  if (planKind === "unilevel_plus") {
    // DEFERRED, not run here.
    //
    // `distributeUnilevelPlusCommission` starts and owns its own Mongo
    // transaction and cannot join the caller's session. Calling it
    // from inside this one would nest an independent transaction that
    // commits even if the bond purchase or payout rolled back —
    // leaving commission paid for a trade that never happened.
    //
    // So: write the ledger row inside the caller's transaction (so the
    // obligation is recorded atomically with the money that created
    // it) and hand the payout back for the caller to run AFTER commit.
    const { getActiveUnilevelPlusPlan } = await import(
      "./unilevelPlusCommission"
    );
    const upPlan = await getActiveUnilevelPlusPlan();
    if (!upPlan) {
      await writeLedger(input, 0, "no_active_unilevel_plan", session);
      return {
        distributed: false,
        recipients,
        unallocatedUsd: poolUsd,
        reason: "no_active_unilevel_plan",
      };
    }
    await writeLedger(input, 0, "deferred_to_post_commit", session);
    return {
      distributed: false,
      planKind,
      recipients,
      unallocatedUsd: 0,
      reason: "deferred",
      deferred: {
        planId: String(upPlan._id),
        buyerId,
        poolUsd,
        paymentId,
        // sweepUnspent:"return" — an unspent remainder stays with the
        // founder rather than being swept to the platform. They funded
        // this pool; seizing the remainder would charge them for
        // positions nobody filled.
        metadata: {
          source: "hifi_bond",
          bondInstrumentId: String(instrumentId),
          bondHoldingId: String(holdingId),
          bondCurrency: currency,
          bondPoolAtomic: poolAtomic,
        },
      },
    };
  } else {
    // ---- levels ----
    const levels: { level: number; percentage: number }[] = (plan.levels || [])
      .slice()
      .sort((a: any, b: any) => a.level - b.level);
    const totalPct = levels.reduce((s, l) => s + Number(l.percentage || 0), 0);
    if (totalPct <= 0) {
      await writeLedger(input, 0, "levels_total_zero", session);
      return { distributed: false, recipients, unallocatedUsd: poolUsd, reason: "levels_total_zero" };
    }

    const { getReferralChain } = await import("./commission");
    const chain = await getReferralChain(buyerId, levels.length);
    const byLevel = new Map(chain.map((c) => [c.level, c.userId]));

    let paid = 0;
    for (const lvl of levels) {
      const share = (poolUsd * Number(lvl.percentage)) / totalPct;
      const rounded = Math.round(share * 100) / 100;
      if (rounded <= 0) continue;
      const recipientId = byLevel.get(lvl.level);
      if (!recipientId) {
        // Nobody at this depth — the share stays with the founder.
        unallocatedUsd += rounded;
        continue;
      }
      await creditAffiliateOrPlatform({
        recipientUserId: recipientId,
        amount: rounded,
        currency: "USD",
        description: `Bond commission — level ${lvl.level}`,
        note: `${kind} on bond ${instrumentId}`,
        relatedUserId: buyerId,
        metadata: {
          kind: `bond_${kind}`,
          bondInstrumentId: String(instrumentId),
          bondHoldingId: String(holdingId),
          ...(payoutEventId ? { bondPayoutEventId: String(payoutEventId) } : {}),
          level: lvl.level,
          dedupeKey: `${paymentId}_l${lvl.level}`,
        },
        session,
      });
      recipients.push({ userId: recipientId, amountUsd: rounded, level: lvl.level });
      paid += rounded;
    }
    unallocatedUsd = Math.round((poolUsd - paid) * 100) / 100;
  }

  await writeLedger(input, recipients.length, undefined, session);
  return { distributed: recipients.length > 0, planKind, recipients, unallocatedUsd };
}

async function writeLedger(
  input: DistributeBondCommissionInput,
  recipientCount: number,
  reason: string | undefined,
  session: mongoose.ClientSession,
) {
  await BondLedgerEntry.create(
    [
      {
        kind: input.kind,
        instrumentId: input.instrumentId,
        holdingId: input.holdingId,
        payoutEventId: input.payoutEventId || null,
        orgId: input.orgId,
        fromUserId: null,
        toUserId: null,
        currency: input.currency,
        amountAtomic: input.poolAtomic,
        poolUsd: input.poolUsd,
        fxRateToUsd: input.fxRateToUsd,
        note: reason
          ? `Pool not distributed: ${reason}`
          : `Pool split across ${recipientCount} recipient(s)`,
      },
    ],
    { session },
  );
}


/**
 * Run a deferred Unilevel Plus payout. Call AFTER the caller's
 * transaction has committed — never inside one.
 *
 * Idempotent on `paymentId`, so a retry after a partial failure cannot
 * double-pay.
 */
export async function runDeferredUpPayout(
  d: DeferredUpPayout,
): Promise<{ recipients: number; unspentUsd: number }> {
  const { distributeUnilevelPlusCommission } = await import(
    "./unilevelPlusCommission"
  );
  const res = await distributeUnilevelPlusCommission({
    buyerId: d.buyerId,
    planId: d.planId,
    saleAmount: d.poolUsd,
    currency: "USD",
    paymentId: d.paymentId,
    sweepUnspent: "return",
    metadata: d.metadata,
  });
  return {
    recipients:
      (res.directBonusPaid ? 1 : 0) + (res.levelBonusesPaid?.length || 0),
    unspentUsd: res.unspentAmount || 0,
  };
}
