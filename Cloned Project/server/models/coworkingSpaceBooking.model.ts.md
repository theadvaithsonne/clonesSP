# `server/models/coworkingSpaceBooking.model.ts`

> Mongoose model for a founder's request to book seats in a coworking space office type, reviewed and approved or rejected by a Garage admin.

**Kind:** Mongoose model · **Lines:** 90

## Purpose
Founders browse `CoworkingSpace` listings and submit a booking request for a number of seats over a single day or a date range. The request waits as `pending` until a Garage admin approves or rejects it. Founder, organisation, space and office-type names are copied onto the booking so admin lists render without joins.

## How it works
- **Requester (denormalised):** `founderId` (ref `User`), `founderName`, `founderEmail`, `organizationId` (ref `Organization`), `organizationName` - all required.
- **What is booked (denormalised):** `coworkingSpaceId` (ref `CoworkingSpace`), `coworkingSpaceName`, `officeTypeId` (the office type sub-document `_id`; no `ref`), `officeTypeName`, `pricePerSeat` (snapshot).
- **Details:** `bookingType` (`single` or `range`), `startDate`, `endDate`, `numberOfSeats` (min 1), `totalAmount` (min 0).
- **Approval:** `status` (`pending` default, `approved`, `rejected`, `cancelled`), `statusNote`, `reviewedBy` (ref `GarageAdmin`), `reviewedAt`.
- `timestamps: true`.
- **Indexes:** `{founderId, status}`, `{organizationId, status}`, `{coworkingSpaceId, status}`, `{status, createdAt:-1}` (admin queue), `{startDate, endDate}`.

`totalAmount` is computed by `createBookingRequest` in `server/controllers/coworkingSpaceBooking.controller.ts`: days = whole days between start and end + 1, daily rate = `pricePerSeat / 30`, total = round(daily rate x days x seats). No payment is taken by this flow; the booking is a request record.

## Exports
- `CoworkingSpaceBooking` - Mongoose model (`"CoworkingSpaceBooking"`, collection `coworkingspacebookings`).
- `ICoworkingSpaceBooking` - document interface.
- `BookingStatus` - `"pending" | "approved" | "rejected" | "cancelled"`.
- `BookingType` - `"single" | "range"`.

## Interfaces
- **Database:** `CoworkingSpaceBooking` (collection `coworkingspacebookings`) - read/write.

## Dependencies
- **Packages:** `mongoose`.

## Used by
`server/controllers/coworkingSpaceBooking.controller.ts`, exposed by `server/routes/coworkingSpaceBooking.ts` mounted at `/coworking-bookings` (browser `/backend/coworking-bookings`): `POST /request`, `GET /my-bookings`, `PATCH /:id/cancel` for founders; `GET /admin/requests`, `/admin/stats`, `/admin/requests/:id` and `PATCH /admin/requests/:id/status` for Garage admins.

## Notes
- Nothing in the model checks capacity or overlapping bookings; `capacity` on the office type is informational unless the controller enforces it.
- The denormalised names do not update if the founder, organisation or space is renamed later.
