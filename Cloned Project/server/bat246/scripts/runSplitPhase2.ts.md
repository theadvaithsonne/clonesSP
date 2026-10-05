# `server/bat246/scripts/runSplitPhase2.ts`

> One-off repair that manually performs "phase 2" of a BAT246 board split (movement records, membership rows and entry counters) for one hard-coded parent board and its two children.

**Kind:** backend one-off script (writes to the production DB) · **Lines:** 122

## Purpose
A board split in `server/bat246/services/bat246Split.service.ts` has two phases. Phase 1 (`splitBoardPhase1`) runs in a transaction: it creates the left and right child boards and marks the parent as split. Phase 2 (the private `runPhase2`) then runs asynchronously, without being awaited, to write the history and stats. If the process or DB connection ends before phase 2 finishes, the child boards exist but nobody has membership rows or movement history. This script redoes phase 2 for one such split.

## How it works
1. `dotenv.config()`, connect to `MONGODB_URI` (fallback `mongodb://localhost:27017/garage`). **Production database in this project.**
2. Hard-coded ids (L18-L20): `PARENT_ID`, `LEFT_ID`, `RIGHT_ID`, the same split as `fixChildBoardInviteProductId.ts`.
3. Loads both child boards (throws if either is missing).
4. `collectMoves` walks every occupied slot on each child board and records `{ playerId, playerName, toPos, toBoardId }`. Positions are named as the game stores them: `homePlate`, `thirdBase`, `secondBaseA`, `secondBaseB`, `firstBase.A`-`firstBase.D`, `atBat.<i>`, `dugout.<i>`, `onDeckCircle.<i>`.
5. Then four steps:
   - **a. Movements:** if no `Bat246Movement` exists with `fromBoardId: PARENT_ID, reason: "split"`, insert one per slot (`fromPosition: "split"`, `toPosition`, `reason: "split"`, `timestamp: now`); otherwise skip.
   - **b. Parent memberships:** `Bat246PlayerBoard.updateMany({ boardId: PARENT_ID, status: "active" }, { $set: { status: "left", leftAt: now } })`.
   - **c. Child memberships:** for each move, upsert `{ playerId, boardId: toBoardId }` with `$setOnInsert` (`position`, `status: "active"`, `joinedAt: now`), so existing rows are left alone. Counts new rows.
   - **d. Entry counts:** for each distinct player id, `$inc minorLeague.totalEntries` by 1.
6. Disconnects; errors exit with code 1.

## Exports
None.

## Interfaces
- **Database:**
  - `Bat246Board` (collection `bat246boards`) - read two boards.
  - `Bat246Movement` (collection `bat246movements`) - count; insert many.
  - `Bat246PlayerBoard` (collection `bat246playerboards`) - update many; upsert.
  - `Bat246Player` (collection `bat246players`) - increment counters.
- **Environment variables:** `MONGODB_URI` - connection string (production).

## Dependencies
- **Internal:** `server/bat246/models/bat246Board.model.ts`, `bat246Player.model.ts`, `bat246PlayerBoard.model.ts`, `bat246Movement.model.ts`.
- **Packages:** `mongoose` (`Types.ObjectId`), `dotenv`.

## Used by
Not imported anywhere. Run by hand, e.g. `npx tsx server/bat246/scripts/runSplitPhase2.ts` (header shows the old `src/...` ts-node path).

## Notes
- **Not idempotent for step d:** every run adds 1 to each player's `minorLeague.totalEntries` again. Steps a and c guard against duplicates; step b is naturally idempotent.
- A player who appears on both children (the old 3rd-base player goes to Home Plate on both) is counted once in step d, because ids are de-duplicated.
- This is a hand-written copy of phase 2 at a point in time; if `runPhase2` in the split service changes, this script will not follow it.
