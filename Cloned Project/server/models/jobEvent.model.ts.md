# `server/models/jobEvent.model.ts`

> Mongoose model for raw per-posting analytics events (a job being viewed, or a candidate starting an application) in the Garage Jobs module.

**Kind:** Mongoose model · **Lines:** 35

## Purpose
Each document is one "view" or "apply_start" event for a `JobPosting`. Together they form the time series behind the founder's job analytics chart. Running totals are kept separately on `JobPosting.stats` (`views`, `applyStarts`) so list views never need to count these rows.

## How it works
- Fields: `orgId` (ref `Organization`, required), `jobId` (ref `JobPosting`, required), `type` (enum `JOB_EVENT_TYPES`, required), optional `userId` (ref `User`, absent for anonymous viewers) and optional `source` (max 40 chars, e.g. the channel the candidate came from).
- Timestamps record only `createdAt` (`updatedAt` disabled) because events are append-only.
- One compound index `{ jobId: 1, type: 1, createdAt: -1 }` serves "events of type X for job Y, newest first" and date-bucketed aggregations.

## Exports
- `JOB_EVENT_TYPES` - `["view", "apply_start"] as const`.
- `IJobEvent` - TypeScript document interface.
- `JobEvent` - the Mongoose model (`model("JobEvent", ...)`).

## Interfaces
- **Database:** `JobEvent` (collection `jobevents`, default Mongoose pluralisation) - written by the candidate routes, aggregated by the founder routes.

## Dependencies
- **Packages:** `mongoose` - schema and model.

## Used by
- `server/routes/jobsCandidate.ts` (mounted at `/jobs`, browser `/backend/jobs`) - `JobEvent.create` with `type: "view"` when a posting is opened and `type: "apply_start"` when an application begins.
- `server/routes/jobsFounder.ts` (mounted at `/jobs/founder`) - `JobEvent.aggregate` for the analytics chart.

## Notes
- There is no TTL index, so the collection grows indefinitely.
