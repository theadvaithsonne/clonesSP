# `server/models/cronLease.model.ts`

> Mongoose model for distributed leases that stop the same periodic job running on several server replicas at once.

**Kind:** Mongoose model · **Lines:** 27

## Purpose
The backend runs many background crons and sweepers. An in-process flag (such as `let sweeping = false`) only protects one Node process; with several replicas each would run the job. `CronLease` stores one document per job name, and replicas compete for it with an atomic update, so only the lease holder runs the job.

## How it works
- `jobName` - required, unique; one row per job.
- `leaseHolder` - session id of the current holder (default `""`).
- `leaseExpiresAt` - when the lease lapses (default `null`).
- `timestamps: true`.

The logic lives in `server/services/cronLease.ts`:
- `acquireLease(jobName, ttlMs)` builds a session id from hostname, process id and time, then `findOneAndUpdate`s the row matching `jobName` whose `leaseExpiresAt` is null or in the past, setting the holder and expiry (upsert creates the row the first time). It returns the session id only if it now holds the lease; a duplicate-key error (another replica won the upsert race) returns `null`.
- `releaseLease(jobName, sessionId)` clears the holder and expiry only if the caller still holds it.

## Exports
- `CronLease` - Mongoose model (`"CronLease"`, collection `cronleases`).
- `ICronLease` - document interface.

## Interfaces
- **Database:** `CronLease` (collection `cronleases`) - read/write.
- **Background work:** coordination primitive for monthly bonus runs and similar jobs.

## Dependencies
- **Packages:** `mongoose`.

## Used by
`server/services/cronLease.ts`, whose `acquireLease` is called by `server/services/cryptosubMonthlyBonus/run.ts`, `server/services/founderSubMonthlyBonus/run.ts`, `server/services/genealogy/snapshot.ts`, `server/services/rankBonus/run.ts` and `server/services/whitelabelMonthlyBonus/run.ts`.

## Notes
- A job that runs longer than its TTL can lose the lease to another replica and be run twice; callers must pick a TTL longer than the worst-case run.
- `jobName` is declared both `unique` and `index`, which is redundant.
