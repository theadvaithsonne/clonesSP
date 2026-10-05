# `server/models/callBooking.model.ts`

> Mongoose model for one scheduled 1:1 call slot that a buyer books against a purchased founder call offering.

**Kind:** Mongoose model · **Lines:** 155

## Purpose
Founders sell "calls" (`CallOffering`); a buyer pays for a number of them (`CallPurchase`) and then books individual time slots, each stored as a `CallBooking`. The model is deliberately separate from the generic `Event` model (the source comment says so) and from the simpler colleague-to-colleague `Booking` model.

## How it works
Fields (`ICallBooking`, with `timestamps`):
- **References:** `callOfferingId` (`CallOffering`), `callPurchaseId` (`CallPurchase`), `organizationId` (`Organization`), all required and indexed.
- **Participants:** `founderId` (the call's creator) and `bookerId` (the buyer, usually a stakeholder), both `User`, required, indexed.
- **Scheduling:** `startTime` (indexed) and `endTime` (`startTime` + the offering's `duration`, computed by the caller).
- **Status:** `scheduled` (default), `completed`, `cancelled`, `no_show`.
- **Notes:** `founderNotes` (private to the founder), `bookingNotes` (written by the booker).
- **Cancellation:** `cancelledAt`, `cancelledBy`, `cancellationReason`.
- **Completion:** `completedAt`, `completedBy`.
- **Rating:** `rating` (1-5), `review`, `ratedAt`.

Indexes, each commented with its query:
- `{ founderId, startTime, status }` - founder calendar.
- `{ bookerId, startTime }` - buyer's scheduled calls.
- `{ callPurchaseId }` - bookings per purchase.
- `{ organizationId, startTime }` - org-wide calendar.
- `{ founderId, startTime, endTime, status }` - overlap/conflict detection (the booking service looks for `scheduled` rows whose interval overlaps the requested one).

A `pre("save")` hook rejects documents where `endTime <= startTime` with `"End time must be after start time"`. It runs only on `save()`/`create()`, not on `updateOne`/`findOneAndUpdate`.

Collection: Mongoose default, `callbookings`.

## Exports
- `CallBooking` - the model (`mongoose.model<ICallBooking>("CallBooking", ...)`).
- `interface ICallBooking` - document type.

## Interfaces
- **Database:** `CallBooking` (collection `callbookings`) - created, rescheduled, completed, cancelled and marked no-show by `server/services/call.ts` and `server/routes/callBooking.ts` (mounted at `/call-bookings`, browser `/backend/call-bookings/...`); listed in `server/routes/calendar.ts` (unified calendar) and `server/routes/unifiedOrders.ts`; read by `server/routes/public.ts` and by `server/realtime/socket.ts`, which, when someone joins a `booking:<bookingId>` call space, reads the booking's `founderId` to mark the founder as the room owner.

## Dependencies
- **Packages:** `mongoose` - schema, model and types.

## Used by
`server/realtime/socket.ts`, `server/routes/calendar.ts`, `server/routes/callBooking.ts`, `server/routes/public.ts`, `server/routes/unifiedOrders.ts`, `server/services/call.ts`.

## Notes
- Completing or no-showing a booking also `$inc`s counters on the related `CallPurchase` (`quantityUsed`, `quantityScheduled`) and `CallOffering` (`totalUsed`); those live in the service/route code, not in hooks here.
- The `{ callPurchaseId: 1 }` compound index duplicates the field-level `index: true` on `callPurchaseId`; harmless but redundant.
