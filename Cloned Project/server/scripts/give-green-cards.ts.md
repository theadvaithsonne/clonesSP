# `server/scripts/give-green-cards.ts`

> Give 2 green cards (salesCredits = 2) to every occupied slot in: Home Plate, 3rd Base, 2nd Base A/B, 1st Base (all 4 sub-slots)

**Kind:** backend one-off script (may write to the production DB) · **Lines:** 55

<!-- docgen:auto -->

## Purpose
Give 2 green cards (salesCredits = 2) to every occupied slot in:
  Home Plate, 3rd Base, 2nd Base A/B, 1st Base (all 4 sub-slots)

AT BAT and Dugout are intentionally NOT touched.

Run: npx ts-node src/scripts/give-green-cards.ts

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

Entry: run by hand: `npx tsx server/scripts/give-green-cards.ts`.

## Notes

- ⚠ **Connects to `MONGODB_URI`** — in this project that is the **production database** (see `.env`). No write operations were detected, but check the code before running.
