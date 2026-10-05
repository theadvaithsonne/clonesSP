# `server/bat246/scripts/triggerSplit.ts`

> One-off script that forces a split of one hard-coded BAT246 board by calling the real split service, then waits five seconds for the asynchronous phase 2 to finish.

**Kind:** backend one-off script (writes to the production DB) · **Lines:** 34

## Purpose
Normally a board splits automatically when all eight AT BAT slots fill. When a board ended up full without splitting (for example after `fixMissingAB8Entry.ts` placed the eighth player by hand), this script starts the split manually.

## How it works
- `dotenv.config()`, connect to `MONGODB_URI` (fallback `mongodb://localhost:27017/garage`). **Production database in this project.**
- Calls `splitBoardPhase1(BOARD_ID)` from `server/bat246/services/bat246Split.service.ts`, with `BOARD_ID` hard-coded at L12 (the same parent board as `fixMissingAB8Entry.ts`, `runSplitPhase2.ts` and `fixChildBoardInviteProductId.ts`). Phase 1 runs in a Mongo transaction: it requires the board to be `status: "active"`, creates the left and right child boards and links them to the parent. It then starts phase 2 (stat updates, movements, memberships) without awaiting it.
- Prints the phase 1 result (parent id, child board ids and numbers), waits 5 seconds so phase 2 can complete, then disconnects. Errors exit with code 1.

## Exports
None.

## Interfaces
- **Database:** through `splitBoardPhase1` and its phase 2 - `Bat246Board` (create two, update the parent) and the related player, membership and movement collections.
- **Environment variables:** `MONGODB_URI` - connection string (production).

## Dependencies
- **Internal:** `server/bat246/services/bat246Split.service.ts` - `splitBoardPhase1`.
- **Packages:** `mongoose`, `dotenv`.

## Used by
Not imported anywhere. Run by hand, e.g. `npx tsx server/bat246/scripts/triggerSplit.ts` (header shows the old `src/...` ts-node path).

## Notes
- The 5-second wait is a guess. If phase 2 takes longer, disconnecting cuts it off; `runSplitPhase2.ts` was written to repair exactly that outcome.
- Phase 1 transactions need a replica set or Atlas cluster; against a standalone local mongod it fails.
- The script does not check that the board's AT BAT is actually full; it only relies on phase 1's `status === "active"` check.
