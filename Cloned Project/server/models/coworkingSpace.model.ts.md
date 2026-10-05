# `server/models/coworkingSpace.model.ts`

> Mongoose model for a physical coworking space listed by Garage admins, with location, amenities and bookable office types priced per seat.

**Kind:** Mongoose model · **Lines:** 80

## Purpose
Garage admins curate a directory of coworking spaces that founders can browse and request to book for their teams. This model stores each listing; bookings are stored separately in `CoworkingSpaceBooking`.

## How it works
- **Listing:** `name` (required), `description`, `images[]`, `amenities[]` (free-text tags).
- **Location** (same pattern as `Organization`): `location`, `city`, `state`, `country`, `latitude`, `longitude`.
- **Office types** (`OfficeTypeSchema`, each with its own `_id`): `name`, `description`, `pricePerSeat` (min 0), `capacity` (min 1), `images[]`. Bookings reference an office type by this sub-document `_id`. The booking controller treats `pricePerSeat` as a monthly rate and divides it by 30 for a daily rate.
- **Rating:** `rating` (0-5, default 0), `ratingCount`.
- **Status:** `isActive` (default true); inactive spaces cannot be booked.
- **Audit:** `createdBy` (ref `GarageAdmin`, required).
- `timestamps: true`.
- **Indexes:** `{name}`, `{city, state, country}`, `{isActive}`, `{"officeTypes.name"}` (used to list distinct office type names).

## Exports
- `CoworkingSpace` - Mongoose model (`"CoworkingSpace"`, collection `coworkingspaces`).
- `ICoworkingSpace` - document interface.
- `IOfficeType` - office type sub-document interface.

## Interfaces
- **Database:** `CoworkingSpace` (collection `coworkingspaces`) - read/write; ref `GarageAdmin`.

## Dependencies
- **Packages:** `mongoose`.

## Used by
`server/controllers/coworkingSpace.controller.ts` (routes in `server/routes/coworkingSpace.ts`, mounted at `/garage-admin/coworking-spaces`, browser `/backend/garage-admin/coworking-spaces`; admin CRUD plus signed-in `GET /public` and `/public/:id` for founders) and `server/controllers/coworkingSpaceBooking.controller.ts` (looks up the space and office type when a booking is requested).

## Notes
- The schema is created without the `ICoworkingSpace` generic, so field typing comes only from the `model<ICoworkingSpace>` call.
