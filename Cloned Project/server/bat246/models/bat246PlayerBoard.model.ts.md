# `server/bat246/models/bat246PlayerBoard.model.ts`

> Join-table Mongoose model recording which player sits on which BAT246 board, at what position, and whether they are still there.

**Kind:** BAT246 game module (backend) — Mongoose model · **Lines:** 20

## Purpose
A board document embeds its occupants in its slot fields, and finding every board one player is on would mean scanning all boards. This collection is the indexed membership list: one row per (board, player). Services use it to find a player's boards and to keep a history of when the player joined and left.

## How it works
Fields (`timestamps: true`):
- `playerId` (→ `bat246Players`, required).
- `boardId` (→ `bat246Boards`, required).
- `position` (String, required): the position key on that board.
- `status`: `active | left`, default `active`.
- `joinedAt` (required) and `leftAt` (default `null`).

Indexes:
- `{ boardId: 1, status: 1 }`: who is on a board.
- `{ playerId: 1, status: 1 }`: a player's boards.
- `{ boardId: 1, playerId: 1 }`, **unique**: a player can have at most one row per board, ever.

Writers and readers:
- `bat246Entry.service.ts` and `bat246.service.ts` create rows on placement.
- `bat246Admin.service.ts` and the split and repair scripts change `position` and `status` with `updateOne` / `updateMany`.
- `bat246.controller.ts` lists rows.

## Exports
- `Bat246PlayerBoard` - Mongoose model registered as `"bat246PlayerBoards"`.

## Interfaces
- **Database:** collection `bat246playerboards`.

## Dependencies
- **Packages:** `mongoose`.

## Used by
- Controller: `server/bat246/controllers/bat246.controller.ts`.
- Services: `server/bat246/services/bat246.service.ts`, `bat246Admin.service.ts`, `bat246Entry.service.ts`, `bat246Split.service.ts`.
- Manual scripts that run against `MONGODB_URI`, the production database: `server/bat246/scripts/backupAndWipeBat246.ts`, `fixMissingAB8Entry.ts`, `runSplitPhase2.ts`, `seedBat246.ts`, and `server/scripts/bat246-backfill-auto-placement.ts`.

## Notes
- Because of the unique `(boardId, playerId)` index, a player who left a board and later returns to it cannot get a second row. Callers must reactivate or update the existing row, or `create()` fails with E11000.
- This table and the board's embedded slots must be kept in step by hand; nothing enforces it.
