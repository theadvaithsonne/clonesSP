# `server/config/founderSubBonus.ts`

> Tier table and payout calculator for the founder Pro-subscription monthly volume bonus.

**Kind:** backend config · **Lines:** 63

## Purpose
At the end of each calendar month a direct referrer is rewarded for the number of **new** $96 Pro-plan office subscriptions they closed that month (renewals do not count, matching the White-label and Cryptosub bonus rules). This file defines the tiers, the earliest month that can be settled, and the env flag name, plus the function that turns a sales count into dollars.

## How it works
- **Tiers (`FOUNDER_SUB_BONUS.tiers`):**
  - fewer than 50 sales -> $0
  - 50 to 99 sales -> $24 per sale (`lowerPerSaleUsdCents: 2400`)
  - 100 or more -> $48 per sale, counting at most 100 sales (`upperCapSales: 100`), so the maximum is $4,800. The cap is described as founder-locked.
- **Funding:** the comments explain the pool is carved out of the $48 platform share that goes to the HQ wallet when a Pro sub is bought (see the Pro branch in `officeSubscription.ts`). At month close the bonus is debited from HQ and credited to the founder; below-tier sales leave the $48 as platform revenue.
- `firstEligiblePeriod: "2026-09"` - the job never settles an earlier month.
- `enabledEnvVar: "FOUNDER_SUB_MONTHLY_BONUS_ENABLED"` - the name of the env var that must equal `"true"` for payouts to run (read by `services/founderSubMonthlyBonus/run.ts`).
- `computeFounderSubBonusUsd(sales)` applies the tiers and rounds to cents. It returns **dollars**, not cents.
- Uses the same cron / lease / dedupe-key pattern as the other monthly bonus jobs (implemented in the services, not here).

## Exports
- `FOUNDER_SUB_BONUS` - `{ tiers, firstEligiblePeriod, enabledEnvVar }`.
- `computeFounderSubBonusUsd(sales: number): number` - bonus in USD for a month's new-sale count.
- `type FounderSubBonusConfig` - `typeof FOUNDER_SUB_BONUS`.

## Interfaces
- **Environment variables:** `FOUNDER_SUB_MONTHLY_BONUS_ENABLED` (named here, read elsewhere).

## Dependencies
None.

## Used by
- `server/services/founderSubMonthlyBonus/qualify.ts` and `run.ts` - qualification and payout.
- `server/services/foundersOfficeCalculator.ts` - shows projected bonus figures.

## Notes
- Jumping from 99 to 100 sales doubles the per-sale rate for every sale (99 -> $2,376, 100 -> $4,800); this cliff is intended by the tier design.
- The tier boundaries in code use `sales < upperThresholdSales` for the lower tier, so exactly 100 sales is in the upper tier.
