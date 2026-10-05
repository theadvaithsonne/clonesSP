# `server/scripts/trim-1101R-dugout.ts`

> One-time test cleanup for board "1-101 R": Removes all dugout entries EXCEPT "brown card test" and "black card test".

**Kind:** backend one-off script (may write to the production DB) · **Lines:** 60

<!-- docgen:auto -->

## Purpose
One-time test cleanup for board "1-101 R":
Removes all dugout entries EXCEPT "brown card test" and "black card test".

Run: npx ts-node src/scripts/trim-1101R-dugout.ts

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

None — this file exports nothing.

## Interfaces

- **Database (Mongoose models used):**
  - `Bat246Board` (server/bat246/models/bat246Board.model.ts) — reads: `findOne`; **writes:** `updateOne`
- **Environment variables (`process.env`):** `MONGODB_URI`

## Dependencies

- **Internal:**
  - `server/bat246/models/bat246Board.model.ts` — `Bat246Board`
- **Packages:**
  - `mongoose`
  - `dotenv`

## Used by

Entry: run by hand: `npx tsx server/scripts/trim-1101R-dugout.ts`.

## Notes

- ⚠ **Connects to `MONGODB_URI`** — in this project that is the **production database** (see `.env`). It performs write operations: `Bat246Board` (updateOne).
