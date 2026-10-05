# `server/scripts/set-board-1min.ts`

> Sets board 1-100's protectionPeriodEnd to now + 1 minute.

**Kind:** backend one-off script (may write to the production DB) · **Lines:** 32

<!-- docgen:auto -->

## Purpose
Sets board 1-100's protectionPeriodEnd to now + 1 minute.

Run: npx ts-node src/scripts/set-board-1min.ts

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

None — this file exports nothing.

## Interfaces

- **Raw collections:** `bat246boards`
- **Environment variables (`process.env`):** `MONGODB_URI`

## Dependencies

- **Internal:** none
- **Packages:**
  - `mongoose`
  - `dotenv`

## Used by

Entry: run by hand: `npx tsx server/scripts/set-board-1min.ts`.

## Notes

- ⚠ **Connects to `MONGODB_URI`** — in this project that is the **production database** (see `.env`). No write operations were detected, but check the code before running.
