# `server/scripts/bat246-distribute-trophies.ts`

> Trophies Distribution sweep — awards permanent T/H/G trophies to every player currently occupying a leaderboard slot on any board.

**Kind:** backend one-off script (may write to the production DB) · **Lines:** 45

<!-- docgen:auto -->

## Purpose
Trophies Distribution sweep — awards permanent T/H/G trophies to every
player currently occupying a leaderboard slot on any board.
Idempotent: already-earned trophies are never re-awarded.

Run: npx ts-node src/scripts/bat246-distribute-trophies.ts

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

None — this file exports nothing.

## Interfaces

- **Database (Mongoose models used):**
  - `Bat246Player` (server/bat246/models/bat246Player.model.ts) — reads: `find`
- **Environment variables (`process.env`):** `MONGODB_URI`

## Dependencies

- **Internal:**
  - `server/bat246/services/bat246Trophy.service.ts` — `distributeTrophies`
  - `server/bat246/models/bat246Player.model.ts` — `Bat246Player`
- **Packages:**
  - `mongoose`
  - `dotenv`

## Used by

Entry: run by hand: `npx tsx server/scripts/bat246-distribute-trophies.ts`.

## Notes

- ⚠ **Connects to `MONGODB_URI`** — in this project that is the **production database** (see `.env`). No write operations were detected, but check the code before running.
