# `server/scripts/bat246-test-board-delete.ts`

> Removes everything bat246-test-board-create.ts made: the test board (tracking number T-9999, mode "test"), its dummy players (@bat246-test.invalid), their dummy distributors and the card history written for the test board.

**Kind:** backend one-off script (may write to the production DB) · **Lines:** 56

<!-- docgen:auto -->

## Purpose
Removes everything bat246-test-board-create.ts made: the test board
(tracking number T-9999, mode "test"), its dummy players (@bat246-test.invalid),
their dummy distributors and the card history written for the test board.

  Dry run:   npx tsx src/scripts/bat246-test-board-delete.ts
  For real:  npx tsx src/scripts/bat246-test-board-delete.ts --confirm

Only ever matches the test markers. Never touches a real board or player.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

None — this file exports nothing.

## Interfaces

- **Database (Mongoose models used):**
  - `Bat246Board` (server/bat246/models/bat246Board.model.ts) — reads: `find`; **writes:** `deleteMany`
  - `Bat246Player` (server/bat246/models/bat246Player.model.ts) — reads: `find`; **writes:** `deleteMany`
  - `Bat246SalesCredit` (server/bat246/models/bat246SalesCredit.model.ts) — reads: `countDocuments`; **writes:** `deleteMany`
  - `Bat246Distributor` (server/bat246/models/bat246Distributor.model.ts) — reads: `countDocuments`; **writes:** `deleteMany`
- **Environment variables (`process.env`):** `MONGODB_URI`

## Dependencies

- **Internal:**
  - `server/bat246/models/bat246Board.model.ts` — `Bat246Board`
  - `server/bat246/models/bat246Player.model.ts` — `Bat246Player`
  - `server/bat246/models/bat246Distributor.model.ts` — `Bat246Distributor`
  - `server/bat246/models/bat246SalesCredit.model.ts` — `Bat246SalesCredit`
- **Packages:**
  - `mongoose`
  - `dotenv`

## Used by

Entry: run by hand: `npx tsx server/scripts/bat246-test-board-delete.ts`.

## Notes

- ⚠ **Connects to `MONGODB_URI`** — in this project that is the **production database** (see `.env`). It performs write operations: `Bat246Board` (deleteMany); `Bat246Player` (deleteMany); `Bat246SalesCredit` (deleteMany); `Bat246Distributor` (deleteMany).
- Command-line flags referenced: `--confirm`.
