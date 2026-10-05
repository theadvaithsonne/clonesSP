# `server/models/timeTracking.model.ts`

> Mongoose model for clock-in / clock-out sessions of a user within an organisation.

**Kind:** Mongoose model · **Lines:** 17

## Purpose
Records working-time sessions used by the Betty assistant routes, public stats and Teamforce payroll attendance. Each document is one session: a clock-in time, an optional clock-out time and the computed duration.

## How it works
Fields (timestamps on): `userId` (-> `User`, required, indexed), `orgId` (-> `Organization`, required, indexed), `clockInTime` (Date, required), `clockOutTime` (Date, optional; `null`/absent means the session is still open), `durationInSeconds` (Number, set on clock-out). A compound index `{ userId: 1, orgId: 1 }` supports per-user-per-org lookups.

Callers treat "open session" as `clockOutTime: null`; for example `server/routes/betty.ts` looks up `TimeTracking.findOne({ userId, orgId, clockOutTime: null })` before creating a new session or closing one.

## Exports
- `TimeTracking` - Mongoose model `"TimeTracking"` (collection `timetrackings`).

## Interfaces
- **Database:** `TimeTracking` (collection `timetrackings`).

## Dependencies
- **Packages:** `mongoose` - `Schema`, `model`, `Types`.

## Used by
`server/routes/betty.ts` (mounted at `/betty`: clock in/out, history, summaries), `server/routes/public.ts` (aggregations), `server/services/teamforce/payroll/attendanceLoader.ts` (payroll attendance), and the hand-run script `server/scripts/teamforce-backfill-clock.ts`.

## Notes
- Nothing in the schema prevents two open sessions for the same user and org; uniqueness of an open session is enforced only by the route logic.
