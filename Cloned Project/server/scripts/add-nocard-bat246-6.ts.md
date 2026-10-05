# `server/scripts/add-nocard-bat246-6.ts`

> Adds 1 noCard to the firstBase slot occupied by player "Bat246-6" Run: npx ts-node src/scripts/add-nocard-bat246-6.ts

**Kind:** backend one-off script (may write to the production DB) · **Lines:** 55

<!-- docgen:auto -->

## Purpose
Adds 1 noCard to the firstBase slot occupied by player "Bat246-6"
Run: npx ts-node src/scripts/add-nocard-bat246-6.ts

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

None — this file exports nothing.

## Interfaces

- **Raw collections:** `bat246players`, `bat246boards`
- **Environment variables (`process.env`):** `MONGODB_URI`

## Dependencies

- **Internal:** none
- **Packages:**
  - `mongoose`
  - `dotenv`

## Used by

Entry: run by hand: `npx tsx server/scripts/add-nocard-bat246-6.ts`.

## Notes

- ⚠ **Connects to `MONGODB_URI`** — in this project that is the **production database** (see `.env`). No write operations were detected, but check the code before running.
