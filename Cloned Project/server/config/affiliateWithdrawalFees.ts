// src/config/affiliateWithdrawalFees.ts
//
// Garage processing fee on AFFILIATE-wallet withdrawals.
//
// The fee is a pricing incentive, not a cost: pay out less often, and leave a
// buffer in the wallet, and the fee falls. Two axes, four outcomes:
//
//                      no $50 kept        $50+ kept
//   daily                  5%                2%
//   weekly                 2%                0%
//
// The payout METHOD does not change the Garage fee. A bank transfer also
// carries whatever the bank charges, which is the bank's fee and not ours —
// it is deducted from the payout and never credited to the platform wallet.
// Crypto payouts carry no such pass-through.
//
// ONLY the affiliate wallet is priced this way. Store and content-rewards
// withdrawals are free and are not affected by any of this
// (services/withdrawal.ts#resolveWithdrawalFee).
//
// A user who has never configured a preference keeps today's flat 5%: the
// discounts are something you opt into, and a silent across-the-board cut for
// every existing user is not a rollout, it is a revenue change nobody asked
// for. The UI pushes them to configure.

import type { WithdrawalFrequency } from "../models/withdrawalPreference.model";

/** Leave at least this much in the wallet to earn the lower tier. */
export const AFFILIATE_KEEP_THRESHOLD_CENTS = 5_000; // $50

/** Charged when the user has no saved preference. Today's behaviour. */
export const AFFILIATE_DEFAULT_FEE_PERCENT = 5;

export type PayoutMethod = "bank" | "crypto";

/** The four configured outcomes. Percent of gross. */
const MATRIX: Record<WithdrawalFrequency, { keep: number; noKeep: number }> = {
  daily: { noKeep: 5, keep: 2 },
  weekly: { noKeep: 2, keep: 0 },
};

export interface AffiliateFeeTier {
  frequency: WithdrawalFrequency;
  /** What they chose to leave behind. */
  keepAmountCents: number;
  /** Does that clear the $50 bar? */
  meetsKeepThreshold: boolean;
  /** Garage processing fee, percent of gross. */
  feePercent: number;
  /** False when no preference is saved — they are on the default 5%. */
  configured: boolean;
}

/**
 * Resolve the Garage fee for an affiliate withdrawal.
 *
 * `pref` is the user's saved preference, or null when they never set one.
 */
export function resolveAffiliateFeeTier(
  pref: {
    frequency?: WithdrawalFrequency | null;
    keepAmountCents?: number | null;
  } | null | undefined
): AffiliateFeeTier {
  if (!pref || !pref.frequency) {
    return {
      frequency: "weekly",
      keepAmountCents: 0,
      meetsKeepThreshold: false,
      feePercent: AFFILIATE_DEFAULT_FEE_PERCENT,
      configured: false,
    };
  }
  const frequency = pref.frequency;
  const keepAmountCents = Math.max(0, pref.keepAmountCents ?? 0);
  const meetsKeepThreshold = keepAmountCents >= AFFILIATE_KEEP_THRESHOLD_CENTS;
  const row = MATRIX[frequency] ?? MATRIX.weekly;
  return {
    frequency,
    keepAmountCents,
    meetsKeepThreshold,
    feePercent: meetsKeepThreshold ? row.keep : row.noKeep,
    configured: true,
  };
}

export interface FeeMatrixCell {
  frequency: WithdrawalFrequency;
  keepsFifty: boolean;
  feePercent: number;
  /** Per payout method, what the user will be charged. */
  methods: {
    method: PayoutMethod;
    feePercent: number;
    bankFeeApplies: boolean;
    /** Ready to render — the exact wording the product uses. */
    label: string;
  }[];
}

const methodLabel = (pct: number, method: PayoutMethod) =>
  method === "bank"
    ? `${pct}% Garage processing fee + bank transfer fees charged by the bank`
    : `${pct}% Garage processing fee`;

/** The whole grid, for the configuration screen. */
export function affiliateFeeMatrix(): FeeMatrixCell[] {
  const cells: FeeMatrixCell[] = [];
  for (const frequency of ["daily", "weekly"] as WithdrawalFrequency[]) {
    for (const keepsFifty of [false, true]) {
      const feePercent = keepsFifty
        ? MATRIX[frequency].keep
        : MATRIX[frequency].noKeep;
      cells.push({
        frequency,
        keepsFifty,
        feePercent,
        methods: (["crypto", "bank"] as PayoutMethod[]).map((method) => ({
          method,
          feePercent,
          bankFeeApplies: method === "bank",
          label: methodLabel(feePercent, method),
        })),
      });
    }
  }
  return cells;
}

/** One line of copy for a resolved tier and a chosen payout method. */
export function describeAffiliateFee(
  tier: AffiliateFeeTier,
  method: PayoutMethod
): string {
  return methodLabel(tier.feePercent, method);
}
