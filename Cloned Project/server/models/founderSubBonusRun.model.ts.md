# `server/models/founderSubBonusRun.model.ts`

> Mongoose model for one monthly founder Pro-subscription volume-bonus run (status, totals, dry-run flag), plus helpers for `YYYY-MM` period keys.

**Kind:** Mongoose model · **Lines:** 128

## Purpose
Each calendar month (UTC) gets at most one run of the founder Pro-sub volume bonus. The run records its lifecycle and aggregate totals. The per-recipient lines are `FounderSubBonusPayout`. The shape mirrors `WhitelabelBonusRun` (status flow, totals, unique `periodKey`) so admin UIs feel the same. It is a sibling model, not a shared one, because the qualifier logic and the tiered amount function differ from the whitelabel and cryptosub bonuses. All amounts are in **dollars** (float).

## How it works
- `FOUNDER_SUB_BONUS_RUN_STATUSES` is `computing -> computed -> paying -> paid`, or `failed`, typed as `FounderSubBonusRunStatus`.
- `TotalsSchema` / `IFounderSubBonusRunTotals` (`_id: false`, all default 0):
  - `evaluatedReferrers`: referrers with at least one qualifying sale.
  - `qualifiedReferrers`: those who cleared the lower threshold.
  - `qualifyingSales`, `bonusUsd` (owed before payment), `paidUsd`, `routedToPlatformUsd`, `failed`.
- Run fields (`IFounderSubBonusRun`):
  - `periodKey` (required, **unique**, must match `YYYY-MM`), `status` (default `computing`, indexed).
  - `dryRun` (required), `snapshotAt`, `startedAt` (required), `computedAt`, `paidAt`.
  - `totals` (default `{}`), `error`, `triggeredBy`. Timestamps are on.
- An index on `{ createdAt: -1 }` serves the newest-first run history.
- Helpers, all UTC:
  - `periodKeyFor(d)` returns `"YYYY-MM"` for the month containing `d`.
  - `previousPeriodKeyFor(d)` returns the key for the month before.
  - `periodBoundsFor(key)` returns `{ start, endExclusive }`: the first instant of the month and of the next month.
  - `emptyTotals()` returns a zeroed totals object.

## Exports
- `FOUNDER_SUB_BONUS_RUN_STATUSES`, `FounderSubBonusRunStatus`.
- `IFounderSubBonusRunTotals`, `IFounderSubBonusRun` - interfaces.
- `FounderSubBonusRun` - the model (default collection `foundersubbonusruns`).
- `periodKeyFor(d: Date): string`
- `previousPeriodKeyFor(d: Date): string`
- `periodBoundsFor(periodKey: string): { start: Date; endExclusive: Date }`
- `emptyTotals(): IFounderSubBonusRunTotals`

## Interfaces
- **Database:** `FounderSubBonusRun` - created and updated by the run service, read by the admin routes.

## Dependencies
- **Packages:** `mongoose`.

## Used by
- `server/services/founderSubMonthlyBonus/run.ts` and `qualify.ts`.
- `server/routes/garageAdminFounderSubMonthlyBonus.ts` (mounted at `/garage-admin/founder-sub-monthly-bonus`): `POST /cron`, `GET /runs`, `GET /current`, and the per-run detail and action routes.

## Notes
- The unique `periodKey` is the run-level idempotency guard. A second run for the same month fails with a duplicate-key error unless the service reuses the existing document.
- `periodBoundsFor` does not validate its input. A malformed key produces `Invalid Date`.
