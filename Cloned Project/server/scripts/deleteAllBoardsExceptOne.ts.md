# `server/scripts/deleteAllBoardsExceptOne.ts`

> Mongoose model `B1` (collection `bat246boards`).

**Kind:** backend one-off script (may write to the production DB) · **Lines:** 56

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Model `B1`

- **Collection:** `bat246boards`

### Model `PB1`

- **Collection:** `bat246playerboards`

### Model `PP1`

- **Collection:** `bat246pendingplacements`

### Model `PR1`

- **Collection:** `bat246positionreservations`

### Model `PN1`

- **Collection:** `bat246placementnotifications`

## Exports

None — this file exports nothing.

## Interfaces

- **Environment variables (`process.env`):** `MONGODB_URI`

## Dependencies

- **Internal:** none
- **Packages:**
  - `mongoose`
  - `dotenv`

## Used by

Entry: run by hand: `npx tsx server/scripts/deleteAllBoardsExceptOne.ts`.

## Notes

- ⚠ **Connects to `MONGODB_URI`** — in this project that is the **production database** (see `.env`). No write operations were detected, but check the code before running.
