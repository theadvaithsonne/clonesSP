# `server/scripts/fix-1101R-wrong-green-cards.ts`

> One-time data correction for board "1-101 R":

**Kind:** backend one-off script (may write to the production DB) · **Lines:** 187

<!-- docgen:auto -->

## Purpose
One-time data correction for board "1-101 R":

Bug: When 1stA used the Approve button to place their 3rd referral into a
slot that belongs to 1stB's pair (e.g. AB3/AB4), the OLD code also awarded
1stB a Green Card — even though 1stB had nothing to do with that referral.

Fix: For every 1st Base slot on this board that received a spurious Green
Card (i.e. a Green Credit with countsForLB=false / saleAmount=0 for an AT
BAT slot whose player was referred by a DIFFERENT 1st Base player):
  1. Delete that Bat246SalesCredit record.
  2. Decrement firstBase[i].salesCredits by 1.
  3. Recompute warpStatus = min(newSalesCredits, 2).
  4. Set firstBase[i].cardType = "NoCard" (signals they can never earn
     both Green Cards now because their pair slot is already claimed).
  5. Decrement Bat246Player.minorLeague.cardsEarned.green by 1.
 […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

None — this file exports nothing.

## Interfaces

- **Database (Mongoose models used):**
  - `Bat246Board` (server/bat246/models/bat246Board.model.ts) — reads: `findOne`; **writes:** `updateOne`
  - `Bat246Player` (server/bat246/models/bat246Player.model.ts) — reads: `findById`, `findOne`; **writes:** `updateOne`
  - `Bat246Distributor` (server/bat246/models/bat246Distributor.model.ts) — reads: `findOne`
  - `Bat246SalesCredit` (server/bat246/models/bat246SalesCredit.model.ts) — reads: `find`; **writes:** `deleteOne`
- **Environment variables (`process.env`):** `MONGODB_URI`

## Dependencies

- **Internal:**
  - `server/bat246/models/bat246Board.model.ts` — `Bat246Board`
  - `server/bat246/models/bat246Player.model.ts` — `Bat246Player`
  - `server/bat246/models/bat246SalesCredit.model.ts` — `Bat246SalesCredit`
  - `server/bat246/models/bat246Distributor.model.ts` — `Bat246Distributor`
- **Packages:**
  - `mongoose` — `Types`
  - `dotenv`

## Used by

Entry: run by hand: `npx tsx server/scripts/fix-1101R-wrong-green-cards.ts`.

## Notes

- ⚠ **Connects to `MONGODB_URI`** — in this project that is the **production database** (see `.env`). It performs write operations: `Bat246Board` (updateOne); `Bat246Player` (updateOne); `Bat246SalesCredit` (deleteOne).
