# `server/services/rankBonus/run.ts`

> src/services/rankBonus/run.ts

**Kind:** backend service · **Lines:** 351

<!-- docgen:auto -->

## Purpose
src/services/rankBonus/run.ts

Orchestrates one monthly rank-bonus run: snapshot → qualify → persist → pay.

Money only moves when RANK_BONUS_PAYOUTS_ENABLED === "true". Default is OFF,
so the job ships in report-only mode: it computes and stores everything,
showing the real bill and the real qualifier list, and pays $0 until someone
deliberately flips the env var and redeploys. There is no reversal machinery
anywhere in this codebase, so that gate is the only protection against a
qualification bug paying out before anyone sees it.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `payoutsEnabled` | function | `payoutsEnabled(): boolean` | 31 |
| `RunOptions` | interface |  | 35 |
| `RunOutcome` | interface |  | 47 |
| `executeRankBonusRun` | function | `async executeRankBonusRun(opts: RunOptions = {}): Promise<RunOutcome>` — Execute a rank-bonus run. | 58 |
| `rankBonusTick` | function | `async rankBonusTick(): Promise<void>` — Hourly tick. Settles the month that has just CLOSED. | 287 |
| `firstEligiblePeriod` | function | `async firstEligiblePeriod(): Promise<string>` — The earliest period the cron may settle. | 313 |
| `shouldSkipTick` | function | `shouldSkipTick(existing: { status: string; dryRun: boolean; }): boolean` — Whether the tick should leave an existing run for this period alone. | 336 |

## Interfaces

- **Database (Mongoose models used):**
  - `RankPlan` (server/models/rankPlan.model.ts) — reads: `findOne`
  - `RankRun` (server/models/rankRun.model.ts) — reads: `findOne`; **writes:** `create`, `updateOne`
  - `User` (server/models/user.model.ts) — reads: `find`
  - `RankQualification` (server/models/rankQualification.model.ts) — **writes:** `deleteMany`, `bulkWrite`
- **Environment variables (`process.env`):** `RANK_BONUS_PAYOUTS_ENABLED`, `RANK_BONUS_FIRST_PERIOD`

## Dependencies

- **Internal:**
  - `server/services/cronLease.ts` — `acquireLease`, `releaseLease`
  - `server/models/rankPlan.model.ts` — `RankPlan`, `payoutFor`, `RankKey`
  - `server/models/rankRun.model.ts` — `RankRun`, `periodKeyFor`, `previousPeriodKeyFor`, `emptyTotals`, `IRankRun`
  - `server/models/rankQualification.model.ts` — `RankQualification`
  - `server/models/user.model.ts` — `User`
  - `server/services/rankBonus/activeSubscribers.ts` — `getActivePaidSubscribers`
  - `server/services/rankBonus/qualify.ts` — `qualifyTree`
  - `server/services/rankBonus/payout.ts` — `payRunQualifications`, `applyRanksToUsers`
- **Packages:**
  - `mongoose` — `Types`

## Used by

- `server/index.ts`
- `server/routes/garageAdminRankBonus.ts`
