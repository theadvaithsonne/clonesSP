# `server/models/booking.model.ts`

> Mongoose model for a simple calendar booking between two members of the same organisation.

**Kind:** Mongoose model · **Lines:** 16

## Purpose
Backs the internal "book time with a colleague" calendar feature. It is a separate, much simpler model than `CallBooking` (which tracks paid founder calls): it only records who booked whom, when, and whether the booking still stands.

## How it works
Fields (all with `timestamps`):
- `orgId` (`Organization`), `bookerId` (`User`, who made the booking), `bookedWithId` (`User`, who is being met). All required and individually indexed.
- `startTime`, `endTime` (required dates) and `title` (required string).
- `status`: `confirmed` (default) or `cancelled`.

Compound indexes `{ orgId, bookerId, startTime }` and `{ orgId, bookedWithId, startTime }` serve per-person calendar and slot lookups. There is no validation that `endTime > startTime` and no overlap constraint; `server/routes/calendar.ts` checks existing bookings when computing slots and creating bookings.

Collection: Mongoose default pluralisation, `bookings`.

## Exports
- `Booking` - the Mongoose model (`model("Booking", BookingSchema)`).

## Interfaces
- **Database:** `Booking` (collection `bookings`) - read and written by `server/routes/calendar.ts` (`GET /:userId/slots`, `GET /bookings`, `POST /bookings`, `PATCH /bookings/:bookingId/cancel`, mounted at `/calendar`, browser `/backend/calendar/...`); updated by `server/services/memberCleanup.service.ts`, which cancels a removed member's future confirmed bookings in that org (`updateMany` to `cancelled`) and, on full account cleanup, deletes their bookings (`deleteMany`).

## Dependencies
- **Packages:** `mongoose` - schema and model. (`Types` is imported but unused.)

## Used by
`server/routes/calendar.ts`, `server/services/memberCleanup.service.ts`.
