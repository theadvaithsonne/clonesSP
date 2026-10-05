# `server/scripts/bat246-test-board-create.ts`

> Creates a fully-populated BAT246 TEST BOARD for mobile-view testing.

**Kind:** backend one-off script (may write to the production DB) · **Lines:** 246

<!-- docgen:auto -->

## Purpose
Creates a fully-populated BAT246 TEST BOARD for mobile-view testing.

  Dry run:   npx tsx src/scripts/bat246-test-board-create.ts
  For real:  npx tsx src/scripts/bat246-test-board-create.ts --confirm
  Remove:    npx tsx src/scripts/bat246-test-board-delete.ts --confirm

- mode: "test"  → the backend serves it ONLY to a frontend running at
  http://localhost:3000 (see bat246TestMode.ts). bat246.com, gotobigwin.com,
  etc. never list or open it.
- hidden: true  → on top of that, only Alan K (redbaron2020@mail.com) can see it.
- Dummy players only ("Alpha Tester", ...). Emails end in @bat246-test.invalid,
  player ids start with "TB", distributor ids end in "TB".
- Writes ONLY raw documents (board, dummy players, dummy distributors, card
  history). It never calls the entry / purchase / split / payout services, so
  no money moves and no transaction, commission or notification is created.
- The Protection Period clock is parked (paused) so no automatic job acts on it. […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

None — this file exports nothing.

## Interfaces

- **Database (Mongoose models used):**
  - `Bat246Board` (server/bat246/models/bat246Board.model.ts) — reads: `findOne`; **writes:** `create`
  - `Bat246Player` (server/bat246/models/bat246Player.model.ts) — **writes:** `insertMany`
  - `Bat246Distributor` (server/bat246/models/bat246Distributor.model.ts) — **writes:** `insertMany`
  - `Bat246SalesCredit` (server/bat246/models/bat246SalesCredit.model.ts) — **writes:** `insertMany`
- **Environment variables (`process.env`):** `MONGODB_URI`

## Dependencies

- **Internal:**
  - `server/bat246/models/bat246Board.model.ts` — `Bat246Board`
  - `server/bat246/models/bat246Player.model.ts` — `Bat246Player`
  - `server/bat246/models/bat246Distributor.model.ts` — `Bat246Distributor`
  - `server/bat246/models/bat246SalesCredit.model.ts` — `Bat246SalesCredit`
- **Packages:**
  - `mongoose` — `Types`
  - `dotenv`

## Used by

Entry: run by hand: `npx tsx server/scripts/bat246-test-board-create.ts`.

## Notes

- ⚠ **Connects to `MONGODB_URI`** — in this project that is the **production database** (see `.env`). It performs write operations: `Bat246Board` (create); `Bat246Player` (insertMany); `Bat246Distributor` (insertMany); `Bat246SalesCredit` (insertMany).
- Command-line flags referenced: `--confirm`.
