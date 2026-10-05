# `server/scripts/bat246-move-lostmoney-lineup-to-waiting.ts`

> One-off: moves everyone currently in the Lost Money "No Wait Lineup" grid back into the "90 Days Waiting Period" grid.

**Kind:** backend one-off script (may write to the production DB) · **Lines:** 61

<!-- docgen:auto -->

## Purpose
One-off: moves everyone currently in the Lost Money "No Wait Lineup"
grid back into the "90 Days Waiting Period" grid.

Matches the same ACTIVE_LINEUP_FILTER used by GET /paid/admin and by
bat246LostMoneyAutoPay.service.ts — i.e. every row that's either a
legacy row (movedToLineupAt never set) or was previously moved into the
lineup (movedToLineupAt is a real Date). After this script runs, ALL of
them will have movedToLineupAt explicitly set to null, which is exactly
what the "90 Days Waiting Period" grid queries for.

Does NOT touch totalPaid, roundAccumulated, approvedAmount, or order —
only changes which grid a row shows in / pauses it from future auto-pay
rounds. Nothing already paid out is undone or reversed.

Run: npx ts-node src/scripts/bat246-move-lostmoney-lineup-to-waiting.ts
Optional: pass one or more Paid List row ids to only move those specific […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

None — this file exports nothing.

## Interfaces

- **Database (Mongoose models used):**
  - `Bat246LostMoneyPaid` (server/bat246/models/bat246LostMoneyPaid.model.ts) — reads: `find`; **writes:** `updateMany`
- **Environment variables (`process.env`):** `MONGODB_URI`

## Dependencies

- **Internal:**
  - `server/bat246/models/bat246LostMoneyPaid.model.ts` — `Bat246LostMoneyPaid`
- **Packages:**
  - `mongoose`
  - `dotenv`

## Used by

Entry: run by hand: `npx tsx server/scripts/bat246-move-lostmoney-lineup-to-waiting.ts`.

## Notes

- ⚠ **Connects to `MONGODB_URI`** — in this project that is the **production database** (see `.env`). It performs write operations: `Bat246LostMoneyPaid` (updateMany).
