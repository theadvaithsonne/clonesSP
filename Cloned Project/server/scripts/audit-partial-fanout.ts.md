# `server/scripts/audit-partial-fanout.ts`

> audit-partial-fanout.ts — READ-ONLY diagnostic

**Kind:** backend one-off script (may write to the production DB) · **Lines:** 178

<!-- docgen:auto -->

## Purpose
audit-partial-fanout.ts — READ-ONLY diagnostic

Scans CommissionDistribution rows since a given date and flags any CD whose
TerritoryWalletTransaction fan-out is missing one or more of the expected
geo-slice rows (subTerritory / territory / country).

Expected slice count is computed per-CD from the org's + buyer's geo chain
AT SCAN TIME using the same resolvers `distributeTerritoryCommissions` uses.
Because ownership state may have shifted since the CD was written, the
"expected" figure is a lower bound; if it says a slice is missing today
(with current owners resolvable), it was almost certainly missing at
commit time too.

Usage:
  npx tsx src/scripts/audit-partial-fanout.ts --since=2026-07-23
  npx tsx src/scripts/audit-partial-fanout.ts --since=2026-07-23 --limit=200 […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

None — this file exports nothing.

## Interfaces

- **Environment variables (`process.env`):** `MONGODB_URI`

## Dependencies

- **Internal:** none
- **Packages:**
  - `dotenv`
  - `mongoose`

## Used by

Entry: run by hand: `npx tsx server/scripts/audit-partial-fanout.ts`.

## Notes

- ⚠ **Connects to `MONGODB_URI`** — in this project that is the **production database** (see `.env`). No write operations were detected, but check the code before running.
