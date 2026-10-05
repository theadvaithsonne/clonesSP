# `server/scripts/rename-bat246-1001B1.ts`

> One-off fix: renames the placeholder Bat246 player/distributor whose displayed name is literally "Bat246-1" (distributorId "1001B1") to a random 10-character alphanumeric name, so it stops showing as test data on the Home Plate slot of boa…

**Kind:** backend one-off script (may write to the production DB) · **Lines:** 88

<!-- docgen:auto -->

## Purpose
One-off fix: renames the placeholder Bat246 player/distributor whose
displayed name is literally "Bat246-1" (distributorId "1001B1") to a
random 10-character alphanumeric name, so it stops showing as test data
on the Home Plate slot of board 6-1000 (Entry 1).

Schema notes:
- distributorId "1001B1" lives on bat246Distributors (Bat246Distributor model),
  linked to bat246Players via userId/playerId.
- The name shown as "playerName" on board slots is denormalized from
  Bat246Player.nickname at entry time (see bat246Entry.service.ts:
  `playerName: player.nickname || userEmail`).
- So the actual field to rename is Bat246Player.nickname.

Only this one field on this one bat246Players document is modified.

Run: npx ts-node src/scripts/rename-bat246-1001B1.ts

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

None — this file exports nothing.

## Interfaces

- **Database (Mongoose models used):**
  - `Bat246Distributor` (server/bat246/models/bat246Distributor.model.ts) — reads: `findOne`
  - `Bat246Player` (server/bat246/models/bat246Player.model.ts) — reads: `findById`, `findOne`
- **Environment variables (`process.env`):** `MONGODB_URI`

## Dependencies

- **Internal:**
  - `server/bat246/models/bat246Distributor.model.ts` — `Bat246Distributor`
  - `server/bat246/models/bat246Player.model.ts` — `Bat246Player`
- **Packages:**
  - `mongoose`
  - `dotenv`

## Used by

Entry: run by hand: `npx tsx server/scripts/rename-bat246-1001B1.ts`.

## Notes

- ⚠ **Connects to `MONGODB_URI`** — in this project that is the **production database** (see `.env`). No write operations were detected, but check the code before running.
