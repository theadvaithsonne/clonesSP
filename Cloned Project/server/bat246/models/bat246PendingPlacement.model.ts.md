# `server/bat246/models/bat246PendingPlacement.model.ts`

> Mongoose model for a purchase that is waiting to be placed: a user who bought a BAT246 entry through an invite link and now waits to be put into a specific board position.

**Kind:** BAT246 game module (backend) — Mongoose model · **Lines:** 19

## Purpose
When someone buys a BAT246 entry through an invite link that points to a specific board slot (for example `atBat-0`), they are not placed on the board straight away. The checkout and invoice-fulfilment code records a pending placement, which the board UI shows as an AT BAT tooltip until an admin or upline approves the placement.

## How it works
Fields (`timestamps: false`):
- `userId` (→ `User`, required), `userName`, `userEmail` (required).
- `boardId` (required) and `position` (required, for example `"atBat-0"`).
- `refUserId` (→ `User`, required): who created the invite link.
- `purchasedAt` (default now) and `expiresAt` (required; the comment says `purchasedAt` + 24h).
- `isPlaced` (default `false`).

Indexes: `{ boardId: 1, position: 1, isPlaced: 1 }` and `{ userId: 1, isPlaced: 1 }`.

Writers. Each uses an idempotent `updateOne` filtered on `{ userId, boardId, position, isPlaced: false }` with `$setOnInsert` and `upsert: true`, and an `expiresAt` 24 hours ahead:
- `server/routes/invoice.ts`
- `server/routes/productCheckout.ts` (two code paths)
- `server/services/invoice.ts`

Reader: `GET /bat246/boards/:id/pending-placements` returns the unplaced, unexpired rows for a board.

## Exports
- `Bat246PendingPlacement` - Mongoose model registered as `"bat246PendingPlacements"`.

## Interfaces
- **Database:** collection `bat246pendingplacements`.
- **Endpoints using it:** `GET /backend/bat246/boards/:id/pending-placements` (`requireAuth`).

## Dependencies
- **Packages:** `mongoose`.

## Used by
- `server/bat246/routes/bat246.routes.ts`
- `server/routes/invoice.ts`
- `server/routes/productCheckout.ts`
- `server/services/invoice.ts`

## Notes
- No code in the server ever sets `isPlaced: true`. Rows drop out of the tooltip only when `expiresAt` passes, and they are never deleted.
- `boardId` uses `ref: "Bat246Board"`, but the board model is registered as `"bat246Boards"`, so `populate("boardId")` would fail.
