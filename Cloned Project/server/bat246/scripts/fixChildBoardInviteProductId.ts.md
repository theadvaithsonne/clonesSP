# `server/bat246/scripts/fixChildBoardInviteProductId.ts`

> One-off repair that copies `inviteProductId` from one hard-coded parent BAT246 board onto its two child boards.

**Kind:** backend one-off script (writes to the production DB) · **Lines:** 60

## Purpose
`inviteProductId` on a `Bat246Board` is the product that a board's invite links sell. When a board splits, its left and right children should inherit it. Two child boards were created before the split service (`server/bat246/services/bat246Split.service.ts`) was patched to carry the field over, so their invite links had no product. This script fills that gap for those two boards only.

## How it works
1. `dotenv.config()`, connect to `MONGODB_URI` (fallback `mongodb://localhost:27017/garage`). **Production database in this project.**
2. Three hard-coded board ObjectIds (L15-L17): `PARENT_ID`, `LEFT_ID`, `RIGHT_ID`. The same three ids appear in `runSplitPhase2.ts`; `PARENT_ID` is also the board used by `fixMissingAB8Entry.ts` and `triggerSplit.ts`.
3. Loads the parent; throws if missing. If the parent has no `inviteProductId`, logs a warning and exits cleanly without writing.
4. Loads both children (throws if either is missing) and logs their current values.
5. `Bat246Board.updateMany({ _id: { $in: [LEFT_ID, RIGHT_ID] } }, { $set: { inviteProductId } })` and logs `modifiedCount`.
6. Disconnects. Errors exit with code 1.

Safe to re-run: a second run sets the same value and reports 0 modified.

## Exports
None.

## Interfaces
- **Database:** `Bat246Board` (model `bat246Boards`, collection `bat246boards`) - read three boards, update two.
- **Environment variables:** `MONGODB_URI` - connection string (production).

## Dependencies
- **Internal:** `server/bat246/models/bat246Board.model.ts` - board model.
- **Packages:** `mongoose`, `dotenv`.

## Used by
Not imported anywhere. Run by hand, e.g. `npx tsx server/bat246/scripts/fixChildBoardInviteProductId.ts` (header shows the old `src/...` ts-node path).

## Notes
The ids are specific to one historical split. If that data was later wiped (for example by `backupAndWipeBat246.ts`), the script just throws "Parent board ... not found".
