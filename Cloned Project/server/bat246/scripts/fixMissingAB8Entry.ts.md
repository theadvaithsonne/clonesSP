# `server/bat246/scripts/fixMissingAB8Entry.ts`

> One-off repair that manually places test user `battestuser13@yopmail.com` in the AB8 (8th AT BAT) slot of one hard-coded BAT246 board and credits the AB7 player with the referral.

**Kind:** backend one-off script (writes to the production DB) · **Lines:** 134

## Purpose
The test user bought an entry through the AB7 player's generic invite link, but the checkout page did not forward the `bat246GenRef` URL parameter to the backend, so the purchase never placed them on board. This script replays the placement by hand: it writes the slot, the membership row and the entry counter, and awards the referrer a Gold card.

## How it works
1. `dotenv.config()`, connect to `MONGODB_URI` (fallback `mongodb://localhost:27017/garage`). **Production database in this project.**
2. Loads the board `BOARD_ID` (hard-coded at L24; the same parent board used by `triggerSplit.ts`, `runSplitPhase2.ts` and `fixChildBoardInviteProductId.ts`) and prints all AT BAT slots.
3. **Guards:**
   - if `atBat[7]` (AB8) is already filled, it logs who holds it and exits without writing;
   - if `atBat[6]` (AB7) has no `playerId`, it throws, because the referrer cannot be determined.
4. Finds the `User` with `TARGET_EMAIL` (throws if missing; the message points to `addTestUsers10to19.ts`).
5. Finds the user's `Bat246Player` by `userId`, or creates one with `playerIdNo: "<2000 + total player count>HI"`, `nickname` (user name or email), `email`, `memberSince: now`.
6. Builds the new slot: `playerId`, `entryNo` (= `minorLeague.totalEntries + 1` as a string), name, email, `enteredAt`/`joinedBoardAt = now`, `referredBy`/`referredByName` from AB7, and null country fields.
7. Writes, in order:
   - `Bat246Board.updateOne`: `$set atBat.7 = newSlot`, and `atBat.6.cardType = "Gold"` only if AB7 has no `cardType` yet (first referral);
   - `Bat246PlayerBoard.updateOne({ playerId, boardId }, { $set: { position: "atBat.7", status: "active" } }, { upsert: true })`;
   - `Bat246Player.updateOne({ _id }, { $inc: { "minorLeague.totalEntries": 1 } })`.
8. Re-reads the board and reports how many AT BAT slots are filled. If all 8 are filled it only prints a warning: the split is **not** triggered automatically (use `triggerSplit.ts`).
9. Disconnects. Errors exit with code 1.

## Exports
None.

## Interfaces
- **Database:**
  - `Bat246Board` (collection `bat246boards`) - read and update one board.
  - `Bat246Player` (collection `bat246players`) - read, maybe create, increment entry count.
  - `Bat246PlayerBoard` (collection `bat246playerboards`) - upsert one membership.
  - `User` (collection `users`) - read by email.
- **Environment variables:** `MONGODB_URI` - connection string (production).

## Dependencies
- **Internal:** `server/bat246/models/bat246Board.model.ts`, `bat246Player.model.ts`, `bat246PlayerBoard.model.ts` - game records; `server/models/user.model.ts` - Garage user lookup.
- **Packages:** `mongoose`, `dotenv`.

## Used by
Not imported anywhere. Run by hand, e.g. `npx tsx server/bat246/scripts/fixMissingAB8Entry.ts` (header shows the old `src/...` ts-node path).

## Notes
- Bypasses the normal entry service, so none of its side effects happen: no `Bat246SalesCredit` ledger entry, no hot-box update, no movement record, no notifications, no revenue routing.
- The generated `playerIdNo` (`2000 + count`) can collide with an existing id if players were ever deleted.
- The early-exit guard makes it safe to re-run once AB8 is filled; but if it fails after the board write and before the player increment, re-running will abort at the guard and leave the counter un-incremented.
