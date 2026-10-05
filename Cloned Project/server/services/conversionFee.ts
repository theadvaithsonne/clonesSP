// Conversion fee resolution + math.
//
// Pure functions where possible so the arithmetic is unit-testable
// without a database. The one DB-touching function (`resolveFee`) is
// a single indexed read.
//
// THE FEE IS CHARGED ON THE SELL SIDE, IN THE CURRENCY BEING SOLD,
// BEFORE FX:
//
//   gross  = amount the customer submits   (fromCurrency)
//   fee    = round8(gross x feeBps / 10000)
//   net    = round8(gross - fee)
//   credit = convertBetween(net, from, to)
//
// Charging the sell side makes the fee exact and quotable the moment
// the customer types an amount, with no rate involved. Take it out of
// the received BTC instead and the fee becomes rate-dependent, so the
// number shown before the trade is never the number on the receipt.

import { OrgConversionFee, MAX_FEE_BPS } from "../models/orgConversionFee.model";

export { MAX_FEE_BPS };

/** Balances are stored at 8dp and transferBetweenWallets rounds to 1e8
 *  at every step. The fee MUST use identical rounding or `fee + net`
 *  stops equalling `gross`. */
export function round8(n: number): number {
  return Math.round(n * 1e8) / 1e8;
}

export interface ResolvedFee {
  feeBps: number;
  /** Why this rate applied — useful in support conversations. */
  source: "pair" | "default" | "none";
  /** % OF THE FEE routed through the Unilevel Plus tree. 0 = none. */
  compPlanPercentage: number;
}

export interface FeeSplit {
  /** Stays with the founder. */
  founderShare: number;
  /** Goes to the Unilevel Plus tree. */
  compPlanShare: number;
}

export interface FeeBreakdown {
  feeBps: number;
  /** Fee amount, in fromCurrency. */
  amount: number;
  /** What actually gets converted: gross - fee. */
  net: number;
  /** What leaves the payer's wallet: unchanged, the full amount. */
  gross: number;
}

/**
 * Should this pair be charged at all?
 *
 * A true same-currency move (USD -> USD to another org) is a
 * relocation, not a conversion, and is never charged.
 *
 * Stablecoin identity hops (USD <-> USDT <-> USDC) ARE chargeable:
 * the FX layer prices them 1:1, but for an OTC desk moving between
 * fiat USD and a stablecoin is a real service. The founder decides by
 * configuring the pair; absent a pair row they fall to defaultFeeBps
 * like anything else.
 */
export function isChargeablePair(from: string, to: string): boolean {
  return from.toUpperCase() !== to.toUpperCase();
}

/**
 * Look up the fee an org charges for a directional pair.
 *
 * Returns 0 for: an org with no schedule, a pair explicitly marked
 * inactive, or a same-currency move.
 */
export async function resolveFee(
  orgId: string,
  fromCurrency: string,
  toCurrency: string,
): Promise<ResolvedFee> {
  const from = String(fromCurrency).toUpperCase();
  const to = String(toCurrency).toUpperCase();

  if (!isChargeablePair(from, to)) {
    return { feeBps: 0, source: "none", compPlanPercentage: 0 };
  }

  const doc: any = await OrgConversionFee.findOne({ orgId })
    .select("defaultFeeBps pairs compPlanPercentage")
    .lean();
  if (!doc) return { feeBps: 0, source: "none", compPlanPercentage: 0 };

  const compPlanPercentage = clampPct(doc.compPlanPercentage || 0);

  const pair = (doc.pairs || []).find(
    (p: any) => p.fromCurrency === from && p.toCurrency === to,
  );

  if (pair) {
    // An explicit row wins, including an explicit 0. A founder who
    // sets a pair to inactive means "don't charge for this one", NOT
    // "fall back to the default".
    if (pair.isActive === false) {
      return { feeBps: 0, source: "pair", compPlanPercentage: 0 };
    }
    return { feeBps: clampBps(pair.feeBps), source: "pair", compPlanPercentage };
  }

  const def = clampBps(doc.defaultFeeBps || 0);
  return def > 0
    ? { feeBps: def, source: "default", compPlanPercentage }
    : { feeBps: 0, source: "none", compPlanPercentage: 0 };
}

function clampPct(n: number): number {
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(n, 100);
}

/**
 * Split a collected fee between the founder and the comp-plan tree.
 *
 * The residue goes to the FOUNDER, never dropped: founderShare is
 * derived by subtraction so `founderShare + compPlanShare === fee`
 * exactly at 8dp.
 */
export function splitFeeForCompPlan(
  feeAmount: number,
  compPlanPercentage: number,
): FeeSplit {
  const fee = round8(feeAmount);
  const pct = clampPct(compPlanPercentage);
  if (fee <= 0 || pct <= 0) {
    return { founderShare: fee, compPlanShare: 0 };
  }
  const compPlanShare = round8((fee * pct) / 100);
  if (compPlanShare <= 0) {
    // Dust — not worth a tree distribution. Founder keeps it.
    return { founderShare: fee, compPlanShare: 0 };
  }
  return { founderShare: round8(fee - compPlanShare), compPlanShare };
}

function clampBps(n: number): number {
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(Math.floor(n), MAX_FEE_BPS);
}

/**
 * Split a gross amount into fee + net.
 *
 * Invariant: `fee + net === gross` exactly, after rounding. The
 * rounding residue is pushed onto `net`, never left dangling — a
 * stray satoshi here is money that exists in no wallet.
 */
export function computeFee(gross: number, feeBps: number): FeeBreakdown {
  const g = round8(gross);
  if (!feeBps || feeBps <= 0) {
    return { feeBps: 0, amount: 0, net: g, gross: g };
  }
  const amount = round8((g * feeBps) / 10000);
  // A dust conversion whose fee rounds to zero is charged nothing
  // rather than rounded up.
  if (amount <= 0) {
    return { feeBps, amount: 0, net: g, gross: g };
  }
  const net = round8(g - amount);

  // Spec §5 says a fee must never make net <= 0, and assumes the 50%
  // cap makes that unreachable. It doesn't: on a dust amount the fee
  // ROUNDS UP and can swallow the whole thing. 50% of one satoshi is
  // 0.000000005, which rounds to 0.00000001 — the entire amount.
  //
  // Two different situations land here, and they deserve different
  // answers:
  if (net <= 0) {
    if (feeBps >= 10000) {
      // >= 100%. Not a rounding artefact — a corrupt schedule. The
      // cap should have stopped this upstream; fail loudly.
      throw new Error(
        `Conversion fee of ${feeBps}bps is >= 100% and would consume the entire amount ` +
          `(gross ${g}). Refusing.`,
      );
    }
    // Dust: rounding, not pricing. Charge nothing, exactly as we do
    // when a fee rounds DOWN to zero. Never debit the customer for a
    // conversion that would deliver them nothing.
    return { feeBps, amount: 0, net: g, gross: g };
  }
  return { feeBps, amount, net, gross: g };
}

/**
 * Whether the payer is exempt.
 *
 * A founder converting their own funds would pay a fee into their own
 * wallet — the money leaves and returns, netting to zero while
 * cluttering the ledger and the earnings report. Skip it.
 */
export function isFeeExempt(payerUserId: string, beneficiaryUserId: string): boolean {
  return String(payerUserId) === String(beneficiaryUserId);
}

/**
 * Pay the comp-plan slice of a collected fee through the Unilevel Plus
 * tree. Runs AFTER the conversion has committed.
 *
 * Why post-commit: `distributeUnilevelPlusCommission` starts and owns
 * its own Mongo transaction and cannot join the caller's session.
 * Calling it inside one would nest an independent transaction that
 * commits even if the outer conversion rolls back. The platform
 * already runs territory and franchise commissions this way for the
 * same reason.
 *
 * Two things make the gap safe rather than merely acknowledged:
 *
 *   1. The UP engine is idempotent on `paymentId`, so a retry of a
 *      half-finished settlement cannot double-pay.
 *   2. Whatever the tree CANNOT place is refunded to the founder. With
 *      `sweepUnspent: "return"` the engine credits nobody for unfilled
 *      positions, so without this refund a payer with no upline would
 *      have money deducted that reached no one at all.
 */
export async function settleFeeCompPlan(params: {
  transferGroupId: string;
  payerUserId: string;
  founderUserId: string;
  orgId: string;
  /** Currency the fee was collected in. */
  currency: string;
  /** Slice of the fee owed to the tree, in `currency`. */
  compPlanShare: number;
  upPlanId: string;
}): Promise<{
  compPlanShareUsd: number;
  unspentUsd: number;
  refundedToFounder: number;
  recipients: number;
}> {
  const {
    transferGroupId,
    payerUserId,
    founderUserId,
    orgId,
    currency,
    compPlanShare,
    upPlanId,
  } = params;

  // Unilevel Plus pays in USD and hard-codes it on every credit path,
  // so the pool converts at this boundary rather than the engine being
  // parameterised. Same approach the bond commission uses.
  const { convertBetween } = await import("./cryptoFxRate");
  const compPlanShareUsd =
    currency === "USD"
      ? round8(compPlanShare)
      : round8(
          (await convertBetween(compPlanShare, currency as any, "USD")).converted,
        );

  if (compPlanShareUsd <= 0) {
    return { compPlanShareUsd: 0, unspentUsd: 0, refundedToFounder: 0, recipients: 0 };
  }

  const { distributeUnilevelPlusCommission } = await import(
    "./unilevelPlusCommission"
  );
  const res = await distributeUnilevelPlusCommission({
    buyerId: payerUserId,
    planId: upPlanId,
    saleAmount: compPlanShareUsd,
    currency: "USD",
    // Stable: a replay of this settlement is a no-op, not a double-pay.
    paymentId: `convfee_${transferGroupId}`,
    sweepUnspent: "return",
    metadata: {
      source: "wallet_conversion_fee",
      transferGroupId,
      feeCurrency: currency,
      compPlanShare,
      orgId,
    },
  });

  const unspentUsd = round8(res.unspentAmount || 0);
  const recipients =
    (res.directBonusPaid ? 1 : 0) + (res.levelBonusesPaid?.length || 0);

  // Refund the unplaceable remainder in the ORIGINAL currency, derived
  // from the ratio rather than a second FX call — a round trip through
  // the rate would introduce drift the founder would notice.
  let refundedToFounder = 0;
  if (unspentUsd > 0) {
    refundedToFounder = round8(
      (compPlanShare * unspentUsd) / compPlanShareUsd,
    );
    if (refundedToFounder > 0) {
      const { creditStoreWalletExternal } = await import("./wallet");
      await creditStoreWalletExternal({
        userId: founderUserId,
        orgId,
        amount: refundedToFounder,
        currency,
        description: "Conversion fee — unallocated comp-plan share",
        note: `Tree could not place ${unspentUsd} USD of transfer ${transferGroupId}`,
        dedupeKey: `convfee_unspent_${transferGroupId}`,
        clientId: "garage-conversion-fee",
        clientName: "Garage conversion fee settlement",
      });
    }
  }

  return { compPlanShareUsd, unspentUsd, refundedToFounder, recipients };
}
