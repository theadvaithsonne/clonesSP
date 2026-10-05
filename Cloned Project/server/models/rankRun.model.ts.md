# `server/models/rankRun.model.ts`

> Mongoose model with one document per monthly NetworkChain rank bonus run, plus period-key and empty-totals helpers.

**Kind:** Mongoose model · **Lines:** 141

## Purpose
The rank bonus is computed and paid once per closed month. A `RankRun` records that run: which month it pays for, which plan version it used, whether it was a dry run, its progress status and summary totals. `periodKey` is unique, so a second attempt at the same month reuses the existing run instead of creating a parallel one - the first line of defence against double payment (the second is the per-payee `dedupeKey` on each wallet transaction, see `rankQualification.model.ts`).

## How it works
- **Fields:** `periodKey` (`"YYYY-MM"`, required, unique, regex `^\d{4}-\d{2}$`), `planVersion` (the `RankPlan.version` used), `status` (`computing` default | `computed` | `paying` | `paid` | `failed`, indexed), `dryRun` (required; true when `RANK_BONUS_PAYOUTS_ENABLED` was off - everything is computed and stored but no money moves), `snapshotAt` (eligibility means "active at this instant", not over a window), `startedAt`, `computedAt`, `paidAt`, `totals`, `error`, `triggeredBy`, timestamps.
- **Totals (`TotalsSchema`, no `_id`):** `activeSubscribers`, `evaluated` (users examined), `qualified`, `byRank` (Mixed map keyed by rank), `bonusUsd` (owed before payment), `paidUsd` (credited to affiliate wallets), `routedToPlatformUsd` (credited to the platform because the earner has no active UP licence), `failed`. All default to 0.
- **Index:** `{ createdAt: -1 }` for newest-first admin listings, in addition to the unique `periodKey`.
- **Helpers:**
  - `periodKeyFor(d)` - `"YYYY-MM"` of the UTC month containing `d`.
  - `previousPeriodKeyFor(d)` - the month before; a run executing on 1 September pays for August. `Date.UTC` normalises month -1 so January rolls back to December of the previous year.
  - `emptyTotals()` - zeroed totals with every rank key present in `byRank`, so the admin API shape is stable.

## Exports
- `RankRun` - model `"RankRun"` (collection `rankruns`).
- `RANK_RUN_STATUSES` - `["computing", "computed", "paying", "paid", "failed"]`.
- `RankRunStatus` - union type of those statuses.
- `IRankRunTotals`, `IRankRun` - interfaces.
- `periodKeyFor(d: Date): string`, `previousPeriodKeyFor(d: Date): string`, `emptyTotals(): IRankRunTotals` - helpers described above.

## Interfaces
- **Database:** `RankRun` (collection `rankruns`) - schema only.
- **Environment variables:** `RANK_BONUS_PAYOUTS_ENABLED` - not read here, but its state at run time is recorded in `dryRun`.
- **Background work:** runs are created by `rankBonusTick()` in `server/services/rankBonus/run.ts`, scheduled hourly from `server/index.ts` under a distributed lease; the unique `periodKey` makes repeated ticks harmless.

## Dependencies
- **Internal:** `server/models/rankPlan.model.ts` - `RANK_KEYS` for `emptyTotals()`.
- **Packages:** `mongoose` - schema and model.

## Used by
`server/services/rankBonus/run.ts`, `server/services/genealogy/snapshot.ts`, `server/routes/rankBonus.ts` (`/backend/rank-bonus`), `server/routes/garageAdminRankBonus.ts` (`/backend/garage-admin/rank-bonus`), `server/routes/genealogy.ts` (`/backend/affiliate/genealogy`).

## Notes
- Amounts are dollars (floats), matching the wallet layer.
- Period keys use UTC, so a run near midnight on the 1st follows UTC, not local time.
