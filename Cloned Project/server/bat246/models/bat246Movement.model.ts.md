# `server/bat246/models/bat246Movement.model.ts`

> Mongoose model for the BAT246 movement log: one row each time a player moves from one board position to another, possibly on another board.

**Kind:** BAT246 game module (backend) — Mongoose model · **Lines:** 34

## Purpose
Players move around and between boards: on splits, warps, normal progression, dugout promotion and leaderboard moves. This log records each move so a board can show its movement history. The split service writes it in bulk, and the board movements endpoint reads it.

## How it works
Fields (`timestamps: false`):
- `fromBoardId` and `toBoardId` (→ `bat246Boards`, required).
- `playerId` (→ `bat246Players`, required) and `playerName`.
- `fromPosition` and `toPosition` (Strings, required).
- `reason` (required), one of:
  - `split`, `warp`, `progression`, `cpdPlacement`, `dugoutToOnDeck`, `lbMove`, `hpLBQualified`, `hpLeft`.
- `timestamp` (Date, required). This is the event time; the schema has no automatic `createdAt`.

Indexes:
- `{ fromBoardId: 1, timestamp: -1 }`: newest-first history for a board.
- `{ playerId: 1, timestamp: -1 }`: history for a player.

Writers and readers:
- `bat246Split.service.ts` writes rows with `insertMany`, as does the manual script `runSplitPhase2.ts`.
- `getBoardMovements(boardId, limit = 50)` in `bat246.service.ts` reads the rows where `fromBoardId` matches.

## Exports
- `Bat246Movement` - Mongoose model registered as `"bat246Movements"`.

## Interfaces
- **Database:** collection `bat246movements`.
- **Endpoints using it:** `GET /backend/bat246/boards/:id/movements` (`requireAuth`, `bat246.controller.getBoardMovements`).

## Dependencies
- **Packages:** `mongoose`.

## Used by
- `server/bat246/services/bat246.service.ts`
- `server/bat246/services/bat246Split.service.ts`
- `server/bat246/scripts/runSplitPhase2.ts`: a manual split script.
- `server/bat246/scripts/backupAndWipeBat246.ts`: manual backup and wipe.

The two scripts run against `MONGODB_URI`, the production database.

## Notes
- Every row written in the codebase uses `reason: "split"` (in `bat246Split.service.ts` and `runSplitPhase2.ts`). The other enum values are accepted by the schema but no code writes them.
- A board's history query matches only `fromBoardId`, so moves *into* a board appear in the source board's history, not the target's.
