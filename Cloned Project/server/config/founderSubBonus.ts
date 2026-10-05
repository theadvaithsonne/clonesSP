// Founder Pro-sub monthly volume bonus — end-of-month reward paid to
// the direct referrer for the number of NEW $96 Pro-plan office subs
// they closed that calendar month. Renewals do NOT count (matches the
// whitelabel/cryptosub bonus rule).
//
// Tiered:
//   • <50 sales → $0
//   • 50–99 sales → $24 per sale
//   • 100+ sales → $48 per sale, capped at 100 sales (max $4,800)
//
// The bonus pool is CARVED OUT OF the $48 platform share that flows to
// Shorupan HQ at purchase time (see officeSubscription.ts Pro branch).
// At month-close, this bonus is debited from HQ and credited to the
// qualifying founder. Sales below tier keep the $48 as platform
// revenue (no debit).
//
// Uses the same cron / cronLease / dedupeKey pattern as
// whitelabelMonthlyBonus + cryptosubMonthlyBonus.

export const FOUNDER_SUB_BONUS = {
  /**
   * Tiered payout function. Returns dollars.
   *   sales <  50               → $0
   *   sales in [50, 99]         → sales × $24
   *   sales >= 100              → min(sales, 100) × $48 = $4,800 max
   *
   * The cap at 100 sales in the top tier is intentional (founder-locked).
   */
  tiers: {
    lowerThresholdSales: 50,
    upperThresholdSales: 100,
    lowerPerSaleUsdCents: 2_400, // $24
    upperPerSaleUsdCents: 4_800, // $48
    upperCapSales: 100, // max sales counted in the upper tier
  },

  /**
   * Floor — the cron won't settle any period earlier than this even if
   * a legitimate month is in the past. Bump on deploy day.
   */
  firstEligiblePeriod: "2026-09", // YYYY-MM (UTC)

  /** Env flag — matches whitelabel/cryptosub. */
  enabledEnvVar: "FOUNDER_SUB_MONTHLY_BONUS_ENABLED",
};

/**
 * Compute the payout for a referrer with `sales` NEW Pro subs in the
 * month. Returns dollars.
 */
export function computeFounderSubBonusUsd(sales: number): number {
  const t = FOUNDER_SUB_BONUS.tiers;
  if (sales < t.lowerThresholdSales) return 0;
  if (sales < t.upperThresholdSales) {
    return Math.round(sales * (t.lowerPerSaleUsdCents / 100) * 100) / 100;
  }
  // Upper tier — capped at `upperCapSales`.
  const counted = Math.min(sales, t.upperCapSales);
  return Math.round(counted * (t.upperPerSaleUsdCents / 100) * 100) / 100;
}

export type FounderSubBonusConfig = typeof FOUNDER_SUB_BONUS;
