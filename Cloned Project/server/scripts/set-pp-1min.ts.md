# `server/scripts/set-pp-1min.ts`

> Set protectionPeriodEnd to 1 minute from now for board trackingNumber="6-1001" Run: npx tsx src/scripts/set-pp-1min.ts

**Kind:** backend one-off script (may write to the production DB) · **Lines:** 34

<!-- docgen:auto -->

## Purpose
Set protectionPeriodEnd to 1 minute from now for board trackingNumber="6-1001"
Run: npx tsx src/scripts/set-pp-1min.ts

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

None — this file exports nothing.

## Interfaces

- **Database (Mongoose models used):**
  - `Bat246Board` (server/bat246/models/bat246Board.model.ts) — **writes:** `updateOne`
- **Environment variables (`process.env`):** `MONGODB_URI`

## Dependencies

- **Internal:**
  - `server/bat246/models/bat246Board.model.ts` — `Bat246Board`
- **Packages:**
  - `mongoose`
  - `dotenv`

## Used by

Entry: run by hand: `npx tsx server/scripts/set-pp-1min.ts`.

## Notes

- ⚠ **Connects to `MONGODB_URI`** — in this project that is the **production database** (see `.env`). It performs write operations: `Bat246Board` (updateOne).
