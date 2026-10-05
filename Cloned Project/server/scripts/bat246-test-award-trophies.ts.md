# `server/scripts/bat246-test-award-trophies.ts`

> TEST ONLY — manually award trophies on board 6-1000: - Home Plate player: all remaining trophies - 3rd Base player: H trophy Uses the same idempotent awardTrophy (already-owned tiers are skipped).

**Kind:** backend one-off script (may write to the production DB) · **Lines:** 53

<!-- docgen:auto -->

## Purpose
TEST ONLY — manually award trophies on board 6-1000:
  - Home Plate player: all remaining trophies
  - 3rd Base player: H trophy
Uses the same idempotent awardTrophy (already-owned tiers are skipped).

Run: npx ts-node src/scripts/bat246-test-award-trophies.ts

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

None — this file exports nothing.

## Interfaces

- **Database (Mongoose models used):**
  - `Bat246Board` (server/bat246/models/bat246Board.model.ts) — reads: `findById`
  - `Bat246Player` (server/bat246/models/bat246Player.model.ts) — reads: `find`
- **Environment variables (`process.env`):** `MONGODB_URI`

## Dependencies

- **Internal:**
  - `server/bat246/models/bat246Board.model.ts` — `Bat246Board`
  - `server/bat246/models/bat246Player.model.ts` — `Bat246Player`
  - `server/bat246/services/bat246Trophy.service.ts` — `awardTrophy`, `TrophyTier`
- **Packages:**
  - `mongoose`
  - `dotenv`

## Used by

Entry: run by hand: `npx tsx server/scripts/bat246-test-award-trophies.ts`.

## Notes

- ⚠ **Connects to `MONGODB_URI`** — in this project that is the **production database** (see `.env`). No write operations were detected, but check the code before running.
