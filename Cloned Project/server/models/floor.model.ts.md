# `server/models/floor.model.ts`

> Mongoose model for a floor in an organisation's virtual office, with its level and department chips.

**Kind:** Mongoose model · **Lines:** 29

## Purpose
Floors are a core building block of the Garage virtual office (Organization, then Floors, then Departments, then Meeting Rooms). The workspace roster, floor navigation, floor cabinets, invites and many checkout flows that place a buyer onto a floor all key off this model.

## How it works
- `DepartmentSchema` (`_id: false`): `name` (required, trimmed) and `color` (default `""`, optional colour for UI chips).
- `FloorSchema`: `orgId` (ref `Organization`, required, indexed), `level` (required number used for ordering and the animated floor transitions: 1, 2, 3 and so on), `name` (required, for example "Floor 1"), and `departments` (default `[]`). Timestamps are on.
- A unique compound index on `{ orgId, level }` means each level number appears once per org.

## Exports
- `Floor` - the model (default collection `floors`). It has no TypeScript interface.

## Interfaces
- **Database:** `Floor` (collection `floors`).

## Dependencies
- **Packages:** `mongoose`.

## Used by
- `server/routes/floor.ts` (mounted at `/floors`): `GET`/`POST /backend/floors`, `POST /backend/floors/setup`, `PATCH`/`DELETE /backend/floors/:id`, `GET /backend/floors/roster`.
- `server/services/init.ts` - seeds and looks up the Garage HQ default floors at boot.
- Controllers: `cabinet.controller.ts`, `garageAdmin.controller.ts`, `shareableLink.controller.ts`.
- Routes: `affiliate.ts`, `callCheckout.ts`, `channelCheckout.ts`, `courseCheckout.ts`, `downlines.ts`, `guestAuth.ts`, `invites.ts`, `productCheckout.ts`, `publicMeet.ts`, `publicWebinar.ts`, `serviceCheckout.ts`, `supportTickets.ts`, `workshopCheckout.ts`.
- `server/services/itemReserveLicense.ts`, and 19 importers in total.

## Notes
- Inserting a floor with a level that already exists in the org fails with a duplicate-key error (E11000). Callers have to choose the next free level.
