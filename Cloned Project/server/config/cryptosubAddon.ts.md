# `server/config/cryptosubAddon.ts`

> Single source of truth for the Cryptosub office add-on: price, GST, commission split, yearly renewal cadence and the monthly volume bonus.

**Kind:** backend config · **Lines:** 75

## Purpose
Cryptosub is a paid yearly add-on for an office (organisation). This file holds every number the purchase, renewal, commission and bonus code needs, so they cannot drift between services. It is a deliberate structural twin of `server/config/whitelabelAddon.ts` (same price, commission shape, renewal and bonus rules); only the slug and access gate differ, so a cryptobrand org can hold Cryptosub without White-label and vice versa.

## How it works
`CRYPTOSUB_ADDON` is a plain object:
- **Identity / gate:** `slug: "cryptosub"`, matching the `OfficeAddon.slug` seeded in `officeAddon.model.ts`; access is checked with `hasActiveAddon(orgId, "cryptosub")`.
- **Price:** `priceUsdCents: 60000` ($600/year), `currency: "USD"`, `subscriptionPeriod: "yearly"`. Kept in cents for exact arithmetic.
- **Tax:** `gstRate: 18` added on top of the base only for buyers in India; `sacCode: "998314"`.
- **Commission (`commission`):**
  - `directFlatUsdCents: 15000` - $150 flat to the buyer's direct referrer (`referredBy`). If there is no direct referrer, the purchase service adds it to the platform bucket.
  - `cascadePoolUsdCents: 15000` - $150 paid through the Unilevel Plus (UP) plan as six separate $25 UP unit sales, so level bonuses scale six times (the UP level formula is points x point value, not a percentage of sale amount).
  - `platformResidualUsdCents: 600` - $6 baseline to the HQ / platform wallet.
- **Renewal:** `renewalLeadDays: 7` (renewal invoice minted and charged off-session about 7 days before `currentEnd`), `renewalMaxAttempts: 3`, `renewalRetryIntervalHours: 24`.
- **Monthly volume bonus (`monthlyVolumeBonus`):** platform-funded bonus to a direct referrer who closed at least `thresholdSales: 10` **new** Cryptosub activations in a calendar month; it pays `bonusPerSaleUsdCents: 15000` ($150) on every sale retroactively once the threshold is met (10 sales -> $1,500). `firstEligiblePeriod: "2026-09"` (UTC `YYYY-MM`) is a floor: the bonus job refuses to settle earlier months. The bonus only moves money when `CRYPTOSUB_MONTHLY_BONUS_ENABLED === "true"` (checked in `services/cryptosubMonthlyBonus/run.ts`, not here).
- `cryptosubCycleMs()` returns one year as 365 days in milliseconds.

## Exports
- `CRYPTOSUB_ADDON` - the config object described above.
- `type CryptosubAddonConfig` - `typeof CRYPTOSUB_ADDON`.
- `cryptosubCycleMs(): number` - 365 days in ms, used to compute cycle end dates.

## Dependencies
None.

## Used by
- `server/services/cryptosubAddonPurchase.ts` - purchase, renewal and commission.
- `server/services/cryptobrandOfficeBootstrap.ts` - mints the initial invoice.
- `server/services/cryptobrandCheckoutStatus.ts`, `server/services/officePlanStatus.ts`, `server/services/whitelabelAddonPurchase.ts`.
- `server/services/cryptosubMonthlyBonus/qualify.ts` and `run.ts` - bonus qualification and payout.
- `server/routes/cryptobrandCheckout.ts` (mounted at `/org`) - uses the slug.
- Scripts: `server/scripts/retro-migrate-cascade-to-up.ts`, `server/scripts/retro-platform-revenue.ts` (manual maintenance scripts).

## Notes
- The header comment describes the commission as "$150 direct + $144 cascade + $6 platform" totalling $300, but the constants are $150 + $150 + $6 = $306. The code follows the constants (the $150 cascade pool is split into 6 x $25).
- The header also lists `routes/cryptosubAddon.ts` and `services/invoice.ts` as consumers; neither imports this file directly.
- Changing these numbers changes real payouts; there is no per-org override.
