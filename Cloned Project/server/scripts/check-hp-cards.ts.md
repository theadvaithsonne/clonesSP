# `server/scripts/check-hp-cards.ts`

> Script run by hand; see Notes for what it touches.

**Kind:** backend one-off script (may write to the production DB) · **Lines:** 42

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

None — this file exports nothing.

## Interfaces

- **Database (Mongoose models used):**
  - `Bat246Board` (server/bat246/models/bat246Board.model.ts) — reads: `findOne`
  - `Bat246Player` (server/bat246/models/bat246Player.model.ts) — reads: `findById`
- **Environment variables (`process.env`):** `MONGODB_URI`

## Dependencies

- **Internal:**
  - `server/bat246/models/bat246Board.model.ts` — `Bat246Board`
  - `server/bat246/models/bat246Player.model.ts` — `Bat246Player`
- **Packages:**
  - `mongoose`
  - `dotenv`

## Used by

Entry: run by hand: `npx tsx server/scripts/check-hp-cards.ts`.

## Notes

- ⚠ **Connects to `MONGODB_URI`** — in this project that is the **production database** (see `.env`). No write operations were detected, but check the code before running.
