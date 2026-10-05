# `server/controllers/coworkingSpaceBooking.controller.ts`

> Express controller for coworking seat bookings: founders request and cancel bookings, and garage admins list, review, approve or reject them and see summary statistics.

**Kind:** Express controller · **Lines:** 369 · **Mounted at:** `/coworking-bookings` (browser: `/backend/coworking-bookings`)

## Purpose
After browsing the coworking catalogue (`coworkingSpace.controller.ts`), a founder can ask to book seats in one office type of a space for a single day or a date range. A booking starts as `pending`. A garage admin approves or rejects it, and the founder can cancel it while it is still pending. No payment or capacity logic runs here. The controller stores a price snapshot and moves the booking through its states.

## How it works

### Validation (zod)
- `createBookingSchema`: `coworkingSpaceId`, `officeTypeId`, `bookingType` (`"single" | "range"`), `startDate`, `endDate` (strings), `numberOfSeats >= 1`.
- `updateBookingStatusSchema`: `status` (`"approved" | "rejected"`), optional `statusNote`.

### Founder handlers (use `req.user` from `requireAuth`)
- **`createBookingRequest`**:
  1. Takes `userId` and `orgId` from `req.user`, then loads the `User`, the `Organization` and the `CoworkingSpace`. Each lookup returns 404 if missing.
  2. Rejects spaces where `isActive` is false (400). Looks for the office type by matching the subdocument `_id` to `officeTypeId` (404 if not found).
  3. **Pricing:** `days = ceil((end - start) / 1 day) + 1` counts both ends of the range. `pricePerSeat` is treated as a **monthly** rate, so `dailyRate = pricePerSeat / 30`. `totalAmount = round(dailyRate * days * numberOfSeats)`.
  4. Saves a `CoworkingSpaceBooking` with denormalised snapshots: the founder's name and email, the organisation name, the space name, the office type name and `pricePerSeat`. Status is `"pending"`. Returns 201 with a short summary.
  - Bad input returns `400` with the zod error message appended.
- **`getMyBookings`**: lists bookings for this founder in the current organisation, newest first. The optional `?status=` filter accepts `pending|approved|rejected|cancelled`.
- **`cancelBooking`**: finds the booking by `_id` and `founderId`. Only a `pending` booking can be cancelled (otherwise 400). Sets the status to `cancelled`.

### Admin handlers (use `req.garageAdmin`)
- **`getAllBookingRequests`**: every booking, with optional `?status=` and `?coworkingSpaceId=` filters, newest first. The response includes the founder and organisation fields and `reviewedBy`.
- **`getBookingRequestById`**: one booking, with `reviewedBy` populated (`name email`).
- **`updateBookingStatus`**: only for a `pending` booking (otherwise 400). Sets `status`, `statusNote`, `reviewedBy = req.garageAdmin.id` and `reviewedAt = now`.
- **`getBookingStats`**: aggregates count and summed `totalAmount` per status into `{ pending, approved, rejected, cancelled, total }`. Every status is present, with zeros when there are no bookings in it.

All responses use the `ok`/`fail` envelopes from `server/utils/http.ts`. Errors are logged and return 500.

## Exports
- `createBookingRequest(req, res)` - founder creates a pending booking.
- `getMyBookings(req, res)` - founder's bookings in the current organisation.
- `cancelBooking(req, res)` - founder cancels a pending booking.
- `getAllBookingRequests(req, res)` - admin list with filters.
- `getBookingRequestById(req, res)` - admin detail.
- `updateBookingStatus(req, res)` - admin approves or rejects.
- `getBookingStats(req, res)` - admin totals by status.

## Interfaces
- **Endpoints served** (router `server/routes/coworkingSpaceBooking.ts`):
  - `POST /backend/coworking-bookings/request` - `requireAuth`
  - `GET /backend/coworking-bookings/my-bookings` - `requireAuth`
  - `PATCH /backend/coworking-bookings/:id/cancel` - `requireAuth`
  - `GET /backend/coworking-bookings/admin/requests` - `requireGarageAdminAuth`
  - `GET /backend/coworking-bookings/admin/stats` - `requireGarageAdminAuth`
  - `GET /backend/coworking-bookings/admin/requests/:id` - `requireGarageAdminAuth`
  - `PATCH /backend/coworking-bookings/admin/requests/:id/status` - `requireGarageAdminAuth`

  `server/app.ts` also runs `garageAdminPageGate` and `requireAdminVerified` on `/coworking-bookings/admin`, which maps to the admin page key `coworking_bookings`.
- **Database:** `CoworkingSpaceBooking` (default collection `coworkingspacebookings`) - read and write. `CoworkingSpace`, `User` and `Organization` - read only.

## Dependencies
- **Internal:** `server/models/coworkingSpaceBooking.model.ts`, `server/models/coworkingSpace.model.ts`, `server/models/user.model.ts`, `server/models/organization.model.ts` - the models above. `server/utils/http.ts` - `ok`/`fail`.
- **Packages:** `express` (types), `zod` (validation).

## Used by
- `server/routes/coworkingSpaceBooking.ts` (the only importer), mounted at `/coworking-bookings` in `server/app.ts`.

## Notes
- No date checks: `endDate` can be before `startDate`, which gives zero or negative days and a zero or negative `totalAmount`. Dates are not checked for being in the past.
- No capacity or overlap check: `numberOfSeats` is never compared with `officeType.capacity` or with other approved bookings.
- The price assumes 30-day months, and `pricePerSeat` is treated as monthly here. Make sure the admin UI labels prices the same way.
- `cancelBooking` does not filter by organisation, only by `founderId`.
- Name and price fields are snapshots taken at request time. Later edits to the space, the user or the organisation are not reflected in existing bookings.
