# `server/services/founderSubMonthlyBonus/run.ts`

> Orchestrator for the monthly founder Pro-sub volume bonus.

**Kind:** backend service · **Lines:** 233

<!-- docgen:auto -->

## Purpose
Orchestrator for the monthly founder Pro-sub volume bonus.
Mirrors whitelabelMonthlyBonus/run.ts.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `payoutsEnabled` | function | `payoutsEnabled(): boolean` | 22 |
| `RunOptions` | interface |  | 26 |
| `RunOutcome` | interface |  | 31 |
| `executeFounderSubMonthlyBonusRun` | function | `async executeFounderSubMonthlyBonusRun(periodKey: string, opts: RunOptions = {}): Promise<RunOutcome>` | 40 |
| `founderSubMonthlyBonusTick` | function | `async founderSubMonthlyBonusTick(): Promise< RunOutcome \| { skipped: RunOutcome["skip…` — Hourly cron entry. Settles the last-closed month; no-op if already paid. | 199 |
| `currentPeriodKeys` | function | `currentPeriodKeys(): { accruing: string; settling: string; }` | 223 |

## Interfaces

- **Database (Mongoose models used):**
  - `FounderSubBonusRun` (server/models/founderSubBonusRun.model.ts) — reads: `findOne`; **writes:** `findOneAndUpdate`, `updateOne`
  - `FounderSubBonusPayout` (server/models/founderSubBonusPayout.model.ts) — **writes:** `deleteMany`, `findOneAndUpdate`

## Dependencies

- **Internal:**
  - `server/services/cronLease.ts` — `acquireLease`, `releaseLease`
  - `server/models/founderSubBonusRun.model.ts` — `FounderSubBonusRun`, `IFounderSubBonusRun`, `periodKeyFor`, `previousPeriodKeyFor`, `periodBoundsFor`, `emptyTotals`
  - `server/models/founderSubBonusPayout.model.ts` — `FounderSubBonusPayout`
  - `server/services/founderSubMonthlyBonus/qualify.ts` — `qualifyForPeriod`
  - `server/services/founderSubMonthlyBonus/payout.ts` — `payRunPayouts`
  - `server/config/founderSubBonus.ts` — `FOUNDER_SUB_BONUS`
- **Packages:**
  - `mongoose` — `Types`

## Used by

- `server/index.ts`
- `server/routes/garageAdminFounderSubMonthlyBonus.ts`
