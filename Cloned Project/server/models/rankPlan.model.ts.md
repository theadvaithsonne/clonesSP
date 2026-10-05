# `server/models/rankPlan.model.ts`

> Versioned configuration for the NetworkChain monthly rank bonus plan (five ranks, their USD bonuses and qualification thresholds), plus the helper that computes what a rank holder is paid.

**Kind:** Mongoose model · **Lines:** 118

## Purpose
The rank bonus pays NetworkChain affiliates a monthly USD bonus based on the highest rank they qualify for in their referral tree. The plan is **versioned** rather than one mutable document so every past payout explains itself: each `RankRun` stamps the `planVersion` it used, and changing the numbers later never rewrites history. Exactly one version is active at a time - a change means inserting a new version and deactivating the old one.

## How it works
- **Ranks:** `RANK_KEYS = ["Bronze", "Silver", "Gold", "Diamond", "Platinum"]`, ordered low to high; the array index *is* the rank ordinal used by the qualification pass.
- **Tiers (`RankTierSchema`, no `_id`):** `key` (one of `RANK_KEYS`), `bonusUsd` (>= 0, dollars), `requiredActiveDirects` (Bronze only - direct referrals with an active paid subscription), `requiredLegs` (Silver and up - number of distinct legs that must each contain at least one holder of the rank immediately below).
- **Plan fields:** `version` (unique number), `isActive` (default `false`, indexed), `thirdPartyClientId` (which partner's subscriptions count - NetworkChain only), `tiers`, `bronzeStacks` (default `true`), `note` (max 500 chars), timestamps.
- **Tier validator:** `tiers` must contain exactly the five ranks in ascending order; Bronze must set `requiredActiveDirects` and every higher rank must set `requiredLegs`. Otherwise save fails with a descriptive message.
- **One active plan:** a partial unique index on `{ isActive: 1 }` where `isActive: true` means at most one active version; inactive versions never collide.
- **`payoutFor(plan, key)`:** returns the tier's `bonusUsd`. For ranks above Bronze with `bronzeStacks` on, the Bronze bonus is added (for example Silver 200 + Bronze 40 = 240), rounded to cents. Higher ranks never stack with each other. Returns 0 if the tier is missing.

## Exports
- `RankPlan` - model `"RankPlan"` (collection `rankplans`).
- `RANK_KEYS` - ordered rank names (const tuple).
- `RankKey` - union type of the rank names.
- `IRankTier`, `IRankPlan` - interfaces.
- `payoutFor(plan: IRankPlan, key: RankKey): number` - total payout for a rank holder including stacked Bronze.

## Interfaces
- **Database:** `RankPlan` (collection `rankplans`) - schema only; seeded by `server/scripts/seed-rank-plan.ts`.

## Dependencies
- **Packages:** `mongoose` - schema and model.

## Used by
`server/models/rankQualification.model.ts` and `server/models/rankRun.model.ts` (for `RANK_KEYS`), `server/routes/rankBonus.ts` (`/backend/rank-bonus`), `server/routes/garageAdminRankBonus.ts` (`/backend/garage-admin/rank-bonus`), `server/routes/publicRankBonus.ts` (`/backend/public/rank-bonus`), `server/routes/genealogy.ts` (`/backend/affiliate/genealogy`), `server/services/rankBonus/detail.ts`, `server/services/rankBonus/qualify.ts`, `server/services/rankBonus/run.ts`, `server/services/rankBonusCalculator.ts`, `server/services/genealogy/data.ts`, `server/services/genealogy/pure.ts`, and the manual scripts `server/scripts/seed-rank-plan.ts` and `server/scripts/preview-rank-bonus.ts`.

## Notes
- Amounts are **dollars as floats**, matching the wallet layer (`walletTransaction.model.ts`): store `40`, not `4000`.
- `bronzeStacks` exists so the confirmed stacking rule is explicit configuration rather than hidden in payout code.
