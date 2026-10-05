# `server/scripts/backfill-catalog-ownership.ts`

> Backfill: catalog ownerEmail ← Garage FranchiseGlobalAssignment (active)

**Kind:** backend one-off script (may write to the production DB) · **Lines:** 120

<!-- docgen:auto -->

## Purpose
Backfill: catalog ownerEmail ← Garage FranchiseGlobalAssignment (active)

Idempotent. Safe to re-run. For every ACTIVE Garage global assignment,
ensure the corresponding catalog doc's `ownerEmail` matches. Reports rows
that already agreed, rows updated, rows where catalog doc was missing.

Usage:
  npx tsx src/scripts/backfill-catalog-ownership.ts            # dry-run
  npx tsx src/scripts/backfill-catalog-ownership.ts --apply    # write

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

Entry: run by hand: `npx tsx server/scripts/backfill-catalog-ownership.ts`.

## Notes

- ⚠ **Connects to `MONGODB_URI`** — in this project that is the **production database** (see `.env`). No write operations were detected, but check the code before running.
- Command-line flags referenced: `--apply`.
