# `server/services/cryptosubMonthlyBonus/run.ts`

> Orchestrator for the monthly cryptosub volume bonus.

**Kind:** backend service · **Lines:** 262

<!-- docgen:auto -->

## Purpose
Orchestrator for the monthly cryptosub volume bonus.

Two entry points:
  • `cryptosubMonthlyBonusTick()` — called hourly by the in-process
    cron in index.ts. No-op if the last-closed period is already paid.
  • `executeCryptosubMonthlyBonusRun(periodKey, opts)` — admin +
    cron backstop entry point. Guarded by cronLease.

Money only moves when CRYPTOSUB_MONTHLY_BONUS_ENABLED === "true".
Default OFF — lets us deploy code, verify dry-runs, then flip live.

Mirrors the rank-bonus orchestrator's status transitions:
  computing → computed → (paying → paid) | failed
A dry-run stops at "computed" and never enters "paying".

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `payoutsEnabled` | function | `payoutsEnabled(): boolean` | 34 |
| `RunOptions` | interface |  | 38 |
| `RunOutcome` | interface |  | 43 |
| `executeCryptosubMonthlyBonusRun` | function | `async executeCryptosubMonthlyBonusRun(periodKey: string, opts: RunOptions = {}): Promise<RunOutcome>` — Execute or preview the run for a given period. | 57 |
| `cryptosubMonthlyBonusTick` | function | `async cryptosubMonthlyBonusTick(): Promise< RunOutcome \| { skipped: RunOutcome["skip…` — Hourly cron entry. Settles the last-closed month; no-op if that period is already `paid`. | 225 |
| `currentPeriodKeys` | function | `currentPeriodKeys(): { accruing: string; settling: string; }` — Convenience for the admin `/current` endpoint. | 252 |

## Interfaces

- **Database (Mongoose models used):**
  - `CryptosubBonusRun` (server/models/cryptosubBonusRun.model.ts) — reads: `findOne`; **writes:** `findOneAndUpdate`, `updateOne`
  - `CryptosubBonusPayout` (server/models/cryptosubBonusPayout.model.ts) — **writes:** `deleteMany`, `findOneAndUpdate`
- **Environment variables (`process.env`):** `CRYPTOSUB_MONTHLY_BONUS_ENABLED`

## Dependencies

- **Internal:**
  - `server/services/cronLease.ts` — `acquireLease`, `releaseLease`
  - `server/models/cryptosubBonusRun.model.ts` — `CryptosubBonusRun`, `ICryptosubBonusRun`, `periodKeyFor`, `previousPeriodKeyFor`, `periodBoundsFor`, `emptyTotals`
  - `server/models/cryptosubBonusPayout.model.ts` — `CryptosubBonusPayout`
  - `server/services/cryptosubMonthlyBonus/qualify.ts` — `qualifyForPeriod`
  - `server/services/cryptosubMonthlyBonus/payout.ts` — `payRunPayouts`
  - `server/config/cryptosubAddon.ts` — `CRYPTOSUB_ADDON`
- **Packages:**
  - `mongoose` — `Types`

## Used by

- `server/index.ts`
- `server/routes/garageAdminCryptosubMonthlyBonus.ts`
