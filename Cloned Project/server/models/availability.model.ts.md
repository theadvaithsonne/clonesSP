# `server/models/availability.model.ts`

> Mongoose model `Availability`: a user's weekly working-hours window for one day of the week within an organisation, used to compute bookable calendar slots.

**Kind:** Mongoose model · **Lines:** 14

## Purpose
Stores recurring weekly availability per user per org, which the calendar booking and call services use to work out when someone can be booked.

## How it works
- `userId` (ref `User`) and `orgId` (ref `Organization`) - required, indexed.
- `dayOfWeek` - 0 (Sunday) to 6 (Saturday).
- `startTime`, `endTime` - `"HH:mm"` strings, e.g. `"09:00"`-`"17:00"`.
- `enabled` - default `true`.
- Unique index `{ userId, orgId, dayOfWeek }`: one window per day per user per org (no split shifts).
- Timestamps on; collection `availabilities`.

## Exports
- `Availability` - Mongoose model.

## Interfaces
- **Database:** `Availability` (collection `availabilities`).

## Dependencies
- **Packages:** `mongoose`.

## Used by
- `server/routes/calendar.ts` - mounted at `/calendar` (browser `/backend/calendar`); reads/writes availability, creates weekday defaults when none exist, and computes `GET /calendar/:userId/slots`.
- `server/services/call.ts` - looks up availability for call booking.

## Notes
- Times are bare strings with no timezone; interpretation is left to the callers.
