# `server/models/genealogySnapshot.model.ts`

> Defines two Mongoose models: month-close snapshots of each user's NC status, UP qualification and volume, and a per-month run record for the snapshot job.

**Kind:** Mongoose model · **Lines:** 45

## Purpose
The affiliate Genealogy page shows month-over-month changes ("active delta"). The current month is computed live; the previous month has to come from a frozen record, which is what `GenealogySnapshot` holds. Rows exist only for users with something to record. `GenealogySnapshotRun` marks whether a month's snapshot has been taken.

## How it works
**`GenealogySnapshot`** (one row per user per month):
- `periodKey` - `"YYYY-MM"` in UTC (required).
- `userId` (ref `User`, required).
- `nc` - NetworkChains status: `"active" | "lapsed" | "never"` (required).
- `qualified` - Unilevel Plus qualification (default false).
- `volumeUsd` - personal volume in USD for the month (default 0).
- Unique index `{ periodKey, userId }`; timestamps on.

**`GenealogySnapshotRun`** (one row per month):
- `periodKey` (required, unique), `status` (`"running"` default | `"completed"`), `users` (row count), `completedAt`.

`server/services/genealogy/snapshot.ts` (`snapshotMonth`) skips a month already marked completed, takes a distributed lease, upserts the run as `running`, bulk-upserts snapshot rows in chunks of 1,000, then marks the run `completed` with the user count. `genealogySnapshotTick` runs it for the month that just closed and is scheduled from `server/index.ts`. `server/routes/genealogy.ts` checks for a completed run for the previous month before reading snapshot rows.

## Exports
- `GenealogySnapshot` - model `"GenealogySnapshot"` (default collection `genealogysnapshots`).
- `GenealogySnapshotRun` - model `"GenealogySnapshotRun"` (default collection `genealogysnapshotruns`), untyped.
- `IGenealogySnapshot` - snapshot row interface.

## Interfaces
- **Database:** `genealogysnapshots`, `genealogysnapshotruns` (read/write).

## Dependencies
- **Packages:** `mongoose`.

## Used by
`server/services/genealogy/snapshot.ts` (writer, background tick from `server/index.ts`) and `server/routes/genealogy.ts` (reader; mounted at `/affiliate/genealogy`, browser `/backend/affiliate/genealogy`).

## Notes
- Snapshots cannot be backfilled for months before the job ran; `firstSnapshotPeriod()` in the service (env `GENEALOGY_SNAPSHOT_FIRST_PERIOD`, default `2026-09`) bounds the first month.
