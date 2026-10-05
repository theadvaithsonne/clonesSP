# `server/services/genealogy/snapshot.ts`

> Freezes every user's NC status / UP qualification / monthly volume when a month closes.

**Kind:** backend service · **Lines:** 67

<!-- docgen:auto -->

## Purpose
Freezes every user's NC status / UP qualification / monthly volume when a
month closes. Hourly tick, distributed lease, idempotent upserts — same shape
as services/rankBonus/run.ts.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `firstSnapshotPeriod` | function | `firstSnapshotPeriod(): string` | 14 |
| `snapshotMonth` | function | `async snapshotMonth(periodKey: string)` | 19 |
| `genealogySnapshotTick` | function | `async genealogySnapshotTick(): Promise<void>` — Hourly: make sure the month that just closed has a snapshot. | 60 |
| `periodKeyFor` | export |  | 66 |

## Interfaces

- **Database (Mongoose models used):**
  - `GenealogySnapshotRun` (server/models/genealogySnapshot.model.ts) — reads: `findOne`; **writes:** `updateOne`
  - `GenealogySnapshot` (server/models/genealogySnapshot.model.ts) — **writes:** `bulkWrite`
- **Environment variables (`process.env`):** `GENEALOGY_SNAPSHOT_FIRST_PERIOD`

## Dependencies

- **Internal:**
  - `server/services/cronLease.ts` — `acquireLease`, `releaseLease`
  - `server/models/rankRun.model.ts` — `periodKeyFor`, `previousPeriodKeyFor`
  - `server/models/genealogySnapshot.model.ts` — `GenealogySnapshot`, `GenealogySnapshotRun`
  - `server/services/genealogy/data.ts` — `statusSets`, `ncOf`, `volumeUsdByUser`
  - `server/services/genealogy/pure.ts` — `monthRange`
- **Packages:** none

## Used by

- `server/index.ts`
