# `server/services/cronLease.ts`

> src/services/cronLease.ts Acquire/release helpers for distributed cron leases.

**Kind:** backend service · **Lines:** 70

<!-- docgen:auto -->

## Purpose
src/services/cronLease.ts
Acquire/release helpers for distributed cron leases. Atomic via
findOneAndUpdate + unique index on jobName; safe under concurrent
callers.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `acquireLease` | function | `async acquireLease(jobName: string, ttlMs: number): Promise<string \| null>` — Try to acquire the lease for `jobName`. | 21 |
| `releaseLease` | function | `async releaseLease(jobName: string, sessionId: string): Promise<void>` — Release the lease only if we still hold it. | 61 |

## Interfaces

- **Database (Mongoose models used):**
  - `CronLease` (server/models/cronLease.model.ts) — **writes:** `findOneAndUpdate`, `updateOne`

## Dependencies

- **Internal:**
  - `server/models/cronLease.model.ts` — `CronLease`
- **Packages:**
  - `os`

## Used by

- `server/services/cryptosubMonthlyBonus/run.ts`
- `server/services/founderSubMonthlyBonus/run.ts`
- `server/services/genealogy/snapshot.ts`
- `server/services/rankBonus/run.ts`
- `server/services/whitelabelMonthlyBonus/run.ts`
