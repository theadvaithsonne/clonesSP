# `server/bat246/scripts/fixDugoutPromotion.ts`

> One-off script that promotes waiting dugout players into empty AT BAT slots on every active BAT246 board whose Protection Period has ended.

**Kind:** backend one-off script (writes to the production DB, can trigger board splits) · **Lines:** 45

## Purpose
In the BAT246 game, players who join a board during its Protection Period (PP) wait in the **dugout**; once the PP ends they should move into free **AT BAT** slots. When that promotion did not happen for some boards, this script runs the real game service for each affected board to catch up.

## How it works
1. `dotenv.config()`, connect to `MONGODB_URI` (fallback `mongodb://localhost:27017/garage`). **Production database in this project.**
2. Loads every `Bat246Board` with `status: "active"`.
3. Selects boards where all of these hold:
   - `protectionPeriodEnd` is set and is in the past;
   - the `dugout` array has at least one non-null entry;
   - the `atBat` array has at least one empty (falsy) slot.
4. For each selected board calls `promoteDugoutAfterPP(boardId)` from `server/bat246/services/bat246Entry.service.ts` and logs its `{ moved, splitTriggered }` result.
5. Prints how many boards were processed and disconnects. Errors exit with code 1.

`promoteDugoutAfterPP` does the real work: it re-checks that the board is active and the PP has ended (throwing otherwise), moves dugout players into AT BAT one by one, updates the board's hot-box "Black" card holder to the promoted player's referrer, and calls `splitBoardPhase1` when all 8 AT BAT slots fill.

## Exports
None.

## Interfaces
- **Database:** `Bat246Board` (collection `bat246boards`) - read; plus whatever `promoteDugoutAfterPP` and a resulting split write (boards, player-board memberships, movements, player stats).
- **Environment variables:** `MONGODB_URI` - connection string (production).

## Dependencies
- **Internal:** `server/bat246/models/bat246Board.model.ts` - board query; `server/bat246/services/bat246Entry.service.ts` - `promoteDugoutAfterPP`, the production promotion logic.
- **Packages:** `mongoose`, `dotenv`.

## Used by
Not imported anywhere. Run by hand, e.g. `npx tsx server/bat246/scripts/fixDugoutPromotion.ts` (header shows the old `src/...` ts-node path).

## Notes
- A split started by `promoteDugoutAfterPP` runs its phase 2 asynchronously (not awaited). This script disconnects from Mongo right after the loop, which can cut phase 2 off mid-way; `runSplitPhase2.ts` exists to repair exactly that situation. Keep the process alive for a few seconds (as `triggerSplit.ts` does) if a split is expected.
- Any error thrown for one board (for example "Board is not active") aborts the whole run; boards later in the list are not processed.
