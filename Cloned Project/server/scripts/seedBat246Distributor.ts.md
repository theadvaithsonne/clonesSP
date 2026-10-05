# `server/scripts/seedBat246Distributor.ts`

> Seed one test entry into bat246Distributors.

**Kind:** backend one-off script (may write to the production DB) · **Lines:** 58

<!-- docgen:auto -->

## Purpose
Seed one test entry into bat246Distributors.
Finds the first User in the DB and creates a fully-qualified distributor.

Run:  npx tsx src/scripts/seedBat246Distributor.ts

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

None — this file exports nothing.

## Interfaces

- **Database (Mongoose models used):**
  - `User` (server/models/user.model.ts) — reads: `findOne`; **writes:** `updateOne`
  - `Bat246Distributor` (server/bat246/models/bat246Distributor.model.ts) — **writes:** `deleteOne`, `create`
- **Environment variables (`process.env`):** `MONGODB_URI`

## Dependencies

- **Internal:**
  - `server/bat246/models/bat246Distributor.model.ts` — `Bat246Distributor`
  - `server/models/user.model.ts` — `User`
- **Packages:**
  - `mongoose`
  - `dotenv`

## Used by

Entry: run by hand: `npx tsx server/scripts/seedBat246Distributor.ts`.

## Notes

- ⚠ **Connects to `MONGODB_URI`** — in this project that is the **production database** (see `.env`). It performs write operations: `User` (updateOne); `Bat246Distributor` (deleteOne, create).
