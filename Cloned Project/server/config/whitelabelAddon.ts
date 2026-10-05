// Whitelabel add-on — the single source of truth for pricing, tax,
// commission, and renewal cadence. Referenced by:
//   - services/whitelabelAddonPurchase.ts (purchase + renewal + commission)
//   - routes/whitelabelAddon.ts (price endpoint)
//   - services/invoice.ts fulfillInvoice (whitelabel_addon switch case)
//
// Kept as a constant (not a CombPlan or OfficeAddon doc) because there's
// exactly one whitelabel item, one price, and one commission tier. If
// we later need per-org overrides or multi-tier commission, migrate to
// a DB-backed config.

export const WHITELABEL_ADDON = {
  // Slug matches the existing OfficeAddon.slug so `hasActiveAddon(orgId,
  // "white-label")` continues to gate whitelabel UI/behavior. Same gate,
  // new activation path.
  slug: "white-label",

  // $600.00 USD / year. Priced in the smallest USD unit (cents) to keep
  // arithmetic exact.
  priceUsdCents: 60_000,
  currency: "USD" as const,

  // Subscription cadence — one invoice per year, minted by the renewal
  // cron ~7 days before `currentEnd` and off_session charged.
  subscriptionPeriod: "yearly" as const,

  // GST — 18% added ON TOP OF the base ($600 + $108 = $708 equivalent)
  // only when the buyer is in India. `resolveBuyerGstRegion` +
  // `applyGstToLine` gate this by country, not by currency.
  gstRate: 18,
  sacCode: "998314",

  // Commission — 50% of the BASE (GST excluded) is $300 USD, split
  // across three buckets:
  //   • $150 flat to L1 (buyer's direct referrer)
  //   • $144 depth-weighted cascade across L1..L6 (UP-style weights)
  //   • $6 baseline platform residual (Shorupan's HQ StoreWallet)
  // Any missing-recipient shares (e.g. buyer's chain shorter than 6)
  // sweep INTO the platform bucket, so the total distributed is always
  // exactly $300.
  //
  // Cascade weights are the UP formula (legMultiplier=1, points=level).
  // Kept explicit here (not derived from the live UnilevelPlusPlan) so
  // a founder-side UP rebalance can't accidentally rebalance whitelabel.
  commission: {
    directFlatUsdCents: 15_000,          // $150 → L1 flat direct bonus
    // UP-cascade pool = $150 total, distributed as 6 SEPARATE $25 UP
    // unit sales (see chargeReferralCommission for the loop). Six calls
    // instead of one $150 call because UP's level-bonus formula uses
    // `points × pointValue` (a fixed ¢/point), NOT a % of saleAmount —
    // a single $150 call would pay level bonuses as if it were ONE UP
    // unit, not six. Splitting into 6 × $25 correctly scales level
    // bonuses 6× to match the founder's "6 UP units per sale" model.
    // Per-unit at current plan (pointValue $0.02, 36% direct, 4% co):
    //   $9 direct + $1 company + level pool + infinity tiers + manager.
    cascadePoolUsdCents: 15_000,         // $150 total = 6 × $25
    platformResidualUsdCents: 600,       // $6 baseline sink
  },

  // Renewal — charge N days before currentEnd; retry up to N times
  // spaced 24h before halting the subscription.
  renewalLeadDays: 7,
  renewalMaxAttempts: 3,
  renewalRetryIntervalHours: 24,

  // Monthly volume bonus — an ADDITIONAL platform-funded bonus paid to
  // the direct referrer at end of every calendar month if they closed
  // ≥ thresholdSales NEW whitelabel activations in that month.
  // Retroactive on ALL sales when the threshold is met:
  //   10 sales → $150 * 10 = $1,500 payout
  //   15 sales → $150 * 15 = $2,250 payout
  //   9 sales → $0 (below threshold)
  // This is layered ON TOP of the existing per-sale $150 direct + $6.86
  // cascade — the founder called it out as "from company side, not from
  // combplan". Renewal invoices don't count (see qualify.ts). See
  // services/whitelabelMonthlyBonus/.
  monthlyVolumeBonus: {
    thresholdSales: 10,
    bonusPerSaleUsdCents: 15_000,
    // Floor — the cron won't settle any period earlier than this even
    // if a legitimate month is in the past. Bump on deploy day.
    firstEligiblePeriod: "2026-09", // YYYY-MM (UTC)
  },
};

export type WhitelabelAddonConfig = typeof WHITELABEL_ADDON;

/**
 * Cycle length in ms — one year = 365 days. Kept as a helper so callers
 * don't inline the constant (and so future leap-year handling has one
 * home).
 */
export function whitelabelCycleMs(): number {
  return 365 * 24 * 60 * 60 * 1000;
}
