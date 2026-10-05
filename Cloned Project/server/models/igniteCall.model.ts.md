# `server/models/igniteCall.model.ts`

> Mongoose model linking a Garage affiliate to a NetworkChains catch-up call (an "Ignite call") scheduled by a garage admin.

**Kind:** Mongoose model · **Lines:** 63

## Purpose
Admins schedule Ignite calls for affiliates; the actual meeting is a `MeetSchedule` in contacts-backend (NetworkChains, an external service). This row is Garage's side of that link, used by the garage-admin console's Ignite call table, history list and CSV export.

## How it works
- `userId` (ref `User`) - the affiliate; `adminId` (ref `GarageAdmin`) - the admin responsible.
- NetworkChains references: `ncHostUserId`, `ncScheduleId`, `ncRoomId` (all required strings).
- `title`, `scheduledAt` - snapshots, so the admin UI still renders when contacts-backend is unreachable or the schedule is deleted there.
- `detachedAt` - set when the call is unlinked (live calls have `null`).
- `manuallyCompletedAt` / `manuallyCompletedBy` - an operator's hand override. The four-state status is not stored; it is derived at read time from the live catch-up state in `server/services/igniteCall.service.ts`. The manual override wins over the derived value but is kept separate so the derived truth stays visible.
- `createdBy` (ref `GarageAdmin`). Timestamps on.

Indexes: `{ userId, detachedAt, scheduledAt: -1 }` (newest live call per affiliate); unique `{ userId, ncScheduleId }` (the same catch-up cannot be attached twice to one affiliate).

## Exports
- `IgniteCallModel` - model `"IgniteCall"` (default collection `ignitecalls`).
- `IIgniteCall` - document interface.

## Interfaces
- **Database:** collection `ignitecalls` (read/write).
- **External services:** NetworkChains / contacts-backend (via the routes and service, not this file).

## Dependencies
- **Packages:** `mongoose`.

## Used by
`server/routes/garageAdminIgniteCall.ts` and `server/routes/garageAdminOneTimeAffiliates.ts` (both mounted at `/garage-admin`, browser `/backend/garage-admin`).

## Notes
- The unique index includes detached rows, so re-attaching the same schedule to the same affiliate after detaching would collide unless the old row is reused.
