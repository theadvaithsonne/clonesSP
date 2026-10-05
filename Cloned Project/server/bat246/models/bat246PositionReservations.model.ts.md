# `server/bat246/models/bat246PositionReservations.model.ts`

> Mongoose model for time-limited holds on a BAT246 board position: an invite link or purchase reserves a slot so that it can later be filled by the right person.

**Kind:** BAT246 game module (backend) — Mongoose model · **Lines:** 30

## Purpose
BAT246 invite links can point to a specific slot, such as `atBat-3` on a given board. When the invitee claims the link or buys, that slot is reserved for them for a limited time. Later, `placeUserFromReservation()` in `bat246.service.ts` uses the reservation during admin approval to put the person in the slot. The model also exports the list of reservable positions, which routes use to validate input.

## How it works
`VALID_POSITIONS` lists the positions that can be reserved:
- `thirdBase`, `secondBaseA`, `secondBaseB`;
- `1stA`–`1stD`;
- `atBat-0`–`atBat-7`.

Home Plate, the dugout and the POD are not reservable.

Fields (`timestamps: false`):
- `boardId` (required) and `position` (enum `VALID_POSITIONS`, required).
- `reservedByUserId` (→ `User`, required) and `reservedByEmail` (required).
- `productId` (→ `Product`, default `null`).
- `reservedAt` (default now) and `expiresAt` (required).
- `status`: `active | used | expired`, default `active`.

Indexes:
- `{ boardId, position, status }` for lookups.
- `{ boardId, position }`, **unique** with `partialFilterExpression: { status: "active" }`: at most one active reservation per slot.
- `{ expiresAt: 1 }` with `expireAfterSeconds: 0`: a TTL index.

Lifecycle:
- **Create:**
  - `bat246.service.ts` creates reservations with a 24-hour expiry.
  - `POST /bat246/claim-invite` upserts by slot with a 7-day expiry, re-pointing the slot to the new claimant.
  - `server/routes/invoice.ts`, `productCheckout.ts` and `services/invoice.ts` upsert, keyed on the user's active reservation, after a purchase.
- **Expire:** `getReservations(boardId)` flips stale `active` rows to `expired` before listing.
- **Use:** placement code sets `status: "used"`.

## Exports
- `Bat246PositionReservation` - Mongoose model registered as `"bat246PositionReservations"`.
- `RESERVATION_POSITIONS` - the `VALID_POSITIONS` array, re-exported under this name, for example to validate `position` in `POST /bat246/claim-invite`.

## Interfaces
- **Database:** collection `bat246positionreservations`.
- **Endpoints using it:** `POST /backend/bat246/claim-invite`, plus the board and reservation endpoints served through `bat246.service.ts`.

## Dependencies
- **Packages:** `mongoose`.

## Used by
- `server/bat246/routes/bat246.routes.ts`
- `server/bat246/services/bat246.service.ts`
- `server/routes/invoice.ts`
- `server/routes/productCheckout.ts`
- `server/services/invoice.ts`
- `server/scripts/bat246-backfill-auto-placement.ts`: a manual script that runs against production `MONGODB_URI`.

## Notes
- **The TTL index deletes documents.** The in-code comment says MongoDB "auto-marks as expired", but a TTL index with `expireAfterSeconds: 0` has MongoDB's background monitor (which runs about once a minute) **delete** each document once `expiresAt` passes. That includes `used` reservations. Any code that later expects to find a used or expired reservation (for audit, or for `placeUserFromReservation` after expiry) will find nothing.
- The purchase-side upserts filter on `{ reservedByUserId, status: "active" }`, not on the slot. If the same slot already has an active reservation for a different user, the insert breaks the partial unique index and throws.
- `boardId` uses `ref: "Bat246Board"`, which does not match the registered name `"bat246Boards"`.
