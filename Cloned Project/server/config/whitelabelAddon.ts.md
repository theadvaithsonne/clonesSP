# `server/config/whitelabelAddon.ts`

> Single source of truth for the White-label office add-on: price, GST, commission split, yearly renewal cadence and the monthly volume bonus.

**Kind:** backend config · **Lines:** 96

## Purpose
White-label is a paid yearly add-on that lets an office brand the platform as its own. This file holds the price, tax, commission and renewal numbers used by the purchase and renewal service, the monthly bonus job and several maintenance scripts. It is a code constant rather than a database document because there is exactly one item, one price and one commission tier; the comment suggests moving to a DB-backed config only if per-org overrides are ever needed. `server/config/cryptosubAddon.ts` copies this structure for the Cryptosub add-on.

## How it works
`WHITELABEL_ADDON` is a plain object:
- **Identity / gate:** `slug: "white-label"`, matching the existing `OfficeAddon.slug`, so `hasActiveAddon(orgId, "white-label")` keeps gating White-label UI and behaviour.
- **Price:** `priceUsdCents: 60000` ($600/year), `currency: "USD"`, `subscriptionPeriod: "yearly"`.
- **Tax:** `gstRate: 18`, added on top of the base only for buyers in India (decided by country, not currency, via `resolveBuyerGstRegion` / `applyGstToLine` in the services); `sacCode: "998314"`.
- **Commission (`commission`):**
  - `directFlatUsdCents: 15000` - $150 flat to the buyer's direct referrer; if there is none, the purchase service adds it to the platform bucket.
  - `cascadePoolUsdCents: 15000` - $150 distributed as six separate $25 Unilevel Plus (UP) unit sales. Six calls instead of one because the UP level bonus is points x point value, not a percentage of the sale, so a single $150 call would pay level bonuses for only one unit. The weights are kept explicit here so a founder rebalancing the live UP plan cannot accidentally rebalance White-label.
  - `platformResidualUsdCents: 600` - $6 to the HQ store wallet.
- **Renewal:** `renewalLeadDays: 7`, `renewalMaxAttempts: 3`, `renewalRetryIntervalHours: 24`; after the retries the subscription is halted.
- **Monthly volume bonus (`monthlyVolumeBonus`):** an extra, platform-funded bonus to a direct referrer who closed at least `thresholdSales: 10` **new** activations in a calendar month, paying `bonusPerSaleUsdCents: 15000` ($150) on every sale once the threshold is met (10 -> $1,500, 15 -> $2,250, 9 -> $0). Renewals do not count. `firstEligiblePeriod: "2026-09"` is the earliest month the job will settle. Payouts are only made when `WHITELABEL_MONTHLY_BONUS_ENABLED === "true"` (checked in `services/whitelabelMonthlyBonus/run.ts`).
- `whitelabelCycleMs()` returns 365 days in ms, kept as a helper so leap-year handling would have one home.

## Exports
- `WHITELABEL_ADDON` - the config object.
- `type WhitelabelAddonConfig` - `typeof WHITELABEL_ADDON`.
- `whitelabelCycleMs(): number` - one billing cycle in ms.

## Dependencies
None.

## Used by
- `server/services/whitelabelAddonPurchase.ts` - purchase, renewal, commission (`chargeReferralCommission`).
- `server/services/whiteLabelCalculator.ts`.
- `server/services/whitelabelMonthlyBonus/qualify.ts` and `run.ts`.
- Manual maintenance scripts (run with tsx against the production database): `server/scripts/activate-whitelabel-manual.ts`, `audit-whitelabel-state.ts`, `deactivate-whitelabel-manual.ts`, `diagnose-whitelabel-commission.ts`, `latest-whitelabel-purchase.ts`, `retro-migrate-cascade-to-up.ts`, `retro-platform-revenue.ts`, `revert-whitelabel-invoice.ts`.

## Notes
- Comments describe the cascade as "$144" (and elsewhere a "$6.86 cascade") with a $300 total, while the constants are $150 + $150 + $6 = $306. The code uses the constants.
- The header lists `routes/whitelabelAddon.ts` and `services/invoice.ts` as consumers; they do not import this file directly.
- Editing these values changes real money movement for every future purchase and renewal.
