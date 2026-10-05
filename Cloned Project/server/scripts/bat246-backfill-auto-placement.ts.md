# `server/scripts/bat246-backfill-auto-placement.ts`

> One-time backfill: places any already-qualified BAT246 distributor who joined via a "Without Position" invite link and was never auto-placed (because maybeAutoPlaceFirstBaseReferral didn't exist yet).

**Kind:** backend one-off script (may write to the production DB) · **Lines:** 87

<!-- docgen:auto -->

## Purpose
One-time backfill: places any already-qualified BAT246 distributor who
joined via a "Without Position" invite link and was never auto-placed
(because maybeAutoPlaceFirstBaseReferral didn't exist yet).

For each Bat246Distributor with isQualified=true, isApproved=false,
bat246RefUserId set, and no active position reservation / dugout entry,
runs the same maybeAutoPlaceFirstBaseReferral logic used going forward.

Run: npx ts-node src/scripts/bat246-backfill-auto-placement.ts

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

None — this file exports nothing.

## Interfaces

- **Database (Mongoose models used):**
  - `Bat246Distributor` (server/bat246/models/bat246Distributor.model.ts) — reads: `find`
  - `User` (server/models/user.model.ts) — reads: `findById`
  - `Bat246PositionReservation` (server/bat246/models/bat246PositionReservations.model.ts) — reads: `findOne`
  - `Bat246Player` (server/bat246/models/bat246Player.model.ts) — reads: `findOne`
  - `Bat246PlayerBoard` (server/bat246/models/bat246PlayerBoard.model.ts) — reads: `exists`
- **Environment variables (`process.env`):** `MONGODB_URI`

## Dependencies

- **Internal:**
  - `server/bat246/models/bat246Distributor.model.ts` — `Bat246Distributor`
  - `server/bat246/models/bat246Player.model.ts` — `Bat246Player`
  - `server/bat246/models/bat246PlayerBoard.model.ts` — `Bat246PlayerBoard`
  - `server/bat246/models/bat246PositionReservations.model.ts` — `Bat246PositionReservation`
  - `server/models/user.model.ts` — `User`
  - `server/bat246/services/bat246.service.ts` — `maybeAutoPlaceFirstBaseReferral`
- **Packages:**
  - `mongoose` — `Types`
  - `dotenv`

## Used by

Entry: run by hand: `npx tsx server/scripts/bat246-backfill-auto-placement.ts`.

## Notes

- ⚠ **Connects to `MONGODB_URI`** — in this project that is the **production database** (see `.env`). No write operations were detected, but check the code before running.
