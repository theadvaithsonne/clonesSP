// Cryptosub add-on — the single source of truth for pricing, tax,
// commission, and renewal cadence. Structurally identical to
// whitelabelAddon.ts — same commission shape (3-bucket $150 direct +
// $144 cascade + $6 platform), same yearly-renewal cadence, same
// monthly volume bonus (10 sales → $150/sale). ONLY the slug + access
// gate differ, so a cryptobrand org can have cryptosub without
// whitelabel and vice-versa.
//
// Referenced by:
//   - services/cryptosubAddonPurchase.ts (purchase + renewal + commission)
//   - services/cryptobrandOfficeBootstrap.ts (mints the initial invoice)
//   - routes/cryptosubAddon.ts (price endpoint)
//   - services/invoice.ts fulfillInvoice (cryptosub switch case)
//   - services/cryptosubMonthlyBonus/ (qualify + payout)

export const CRYPTOSUB_ADDON = {
  // Slug matches the OfficeAddon.slug seeded in officeAddon.model.ts
  // OFFICE_ADDONS_CONFIG. Same primitive whitelabel uses:
  // `hasActiveAddon(orgId, "cryptosub")`.
  slug: "cryptosub",

  // $600.00 USD / year. Cents to keep arithmetic exact.
  priceUsdCents: 60_000,
  currency: "USD" as const,

  // Subscription cadence — one invoice per year, minted by the renewal
  // cron ~7 days before `currentEnd` and off_session charged.
  subscriptionPeriod: "yearly" as const,

  // GST — 18% added ON TOP OF the base ($600 + $108 = $708 equivalent)
  // only when the buyer is in India. Same rule as whitelabel.
  gstRate: 18,
  sacCode: "998314",

  // Commission — same 3-bucket shape as whitelabel.
  //   $150 flat → L1 direct referrer (buyer.referredBy)
  //   $144 depth-weighted cascade → L1..L6 (weights [1,2,3,4,5,6], sum=21)
  //   $6 baseline → Shorupan / HQ platform residual
  // Missing chain levels absorb into the platform bucket, so the total
  // distributed is always $300.
  commission: {
    directFlatUsdCents: 15_000, // $150 flat direct
    // UP-cascade pool = $150 total, distributed as 6 SEPARATE $25 UP
    // unit sales — see the twin comment in whitelabelAddon.ts. Six
    // calls (not one) so level bonuses scale 6× (level formula is
    // `points × pointValue`, not a % of saleAmount).
    cascadePoolUsdCents: 15_000, // $150 total = 6 × $25
    platformResidualUsdCents: 600, // $6 baseline sink
  },

  // Renewal — same shape as whitelabel.
  renewalLeadDays: 7,
  renewalMaxAttempts: 3,
  renewalRetryIntervalHours: 24,

  // Monthly volume bonus — a platform-funded bonus paid to the direct
  // referrer at end of every calendar month if they closed ≥
  // thresholdSales NEW cryptosub activations in that month. Retroactive
  // on ALL sales when the threshold is met (10 sales → $1,500).
  monthlyVolumeBonus: {
    thresholdSales: 10,
    bonusPerSaleUsdCents: 15_000, // $150 per sale
    // Floor — the cron won't settle any period earlier than this even
    // if a legitimate month is in the past. Bump on deploy day.
    firstEligiblePeriod: "2026-09", // YYYY-MM (UTC)
  },
};

export type CryptosubAddonConfig = typeof CRYPTOSUB_ADDON;

/** Cycle length in ms — one year = 365 days. */
export function cryptosubCycleMs(): number {
  return 365 * 24 * 60 * 60 * 1000;
}
