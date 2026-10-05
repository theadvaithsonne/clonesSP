# `server/scripts/bat246-who-referred.ts`

> Finds who referred a BAT246 user, by distributorId (e.g.

**Kind:** backend one-off script (may write to the production DB) · **Lines:** 88

<!-- docgen:auto -->

## Purpose
Finds who referred a BAT246 user, by distributorId (e.g. 1012EE) or email.
Run: npx ts-node src/scripts/bat246-who-referred.ts <distributorId|email>

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

None — this file exports nothing.

## Interfaces

- **Database (Mongoose models used):**
  - `Bat246Distributor` (server/bat246/models/bat246Distributor.model.ts) — reads: `findOne`
  - `User` (server/models/user.model.ts) — reads: `findOne`, `findById`
  - `Bat246Player` (server/bat246/models/bat246Player.model.ts) — reads: `findOne`
  - `Bat246Board` (server/bat246/models/bat246Board.model.ts) — reads: `findOne`
- **Environment variables (`process.env`):** `MONGODB_URI`

## Dependencies

- **Internal:**
  - `server/bat246/models/bat246Distributor.model.ts` — `Bat246Distributor`
  - `server/bat246/models/bat246Player.model.ts` — `Bat246Player`
  - `server/bat246/models/bat246Board.model.ts` — `Bat246Board`
  - `server/models/user.model.ts` — `User`
- **Packages:**
  - `mongoose`
  - `dotenv`

## Used by

Entry: run by hand: `npx tsx server/scripts/bat246-who-referred.ts`.

## Notes

- ⚠ **Connects to `MONGODB_URI`** — in this project that is the **production database** (see `.env`). No write operations were detected, but check the code before running.
