# `server/scripts/reset-bat246-boards.ts`

> Reset script — wipes ALL BAT246 board data and player board stats.

**Kind:** backend one-off script (may write to the production DB) · **Lines:** 183

<!-- docgen:auto -->

## Purpose
Reset script — wipes ALL BAT246 board data and player board stats.

DELETES:
  bat246boards             — all boards (active, split, splitting, completed)
  bat246playerboards       — all player↔board memberships
  bat246movements          — all movement history
  bat246pendingplacements  — all pending placements
  bat246positionreservations
  bat246placementnotifications
  bat246topten
  bat246freeentries
  bat246snapbackloans
  bat246recruitment
  bat246salescredits

RESETS (not deleted): […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

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

Entry: run by hand: `npx tsx server/scripts/reset-bat246-boards.ts`.

## Notes

- ⚠ **Connects to `MONGODB_URI`** — in this project that is the **production database** (see `.env`). No write operations were detected, but check the code before running.
