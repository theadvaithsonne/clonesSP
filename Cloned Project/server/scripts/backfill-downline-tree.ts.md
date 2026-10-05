# `server/scripts/backfill-downline-tree.ts`

> src/scripts/backfill-downline-tree.ts One-off, re-runnable backfill for the downline-table denormalized fields on User: ancestors[], depth, legNumber, directsCount, downlineCount, typeFlags.

**Kind:** backend one-off script (may write to the production DB) · **Lines:** 158

<!-- docgen:auto -->

## Purpose
src/scripts/backfill-downline-tree.ts
One-off, re-runnable backfill for the downline-table denormalized fields on
User: ancestors[], depth, legNumber, directsCount, downlineCount, typeFlags.
Builds the whole referral forest in memory, computes each field, and bulk-
writes. Idempotent — running it again just recomputes the same values (also
self-heals any drift from missed enroll/type hooks).

  Run (dev):  DRY_RUN=1 npx tsx src/scripts/backfill-downline-tree.ts
  Run (apply):          npx tsx src/scripts/backfill-downline-tree.ts

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

None — this file exports nothing.

## Interfaces

- **Environment variables (`process.env`):** `DRY_RUN`, `MONGODB_URI`

## Dependencies

- **Internal:** none
- **Packages:**
  - `dotenv`
  - `mongoose`

## Used by

Entry: run through `npm run backfill:downline-tree`, `npm run backfill:downline-tree:prod`.

## Notes

- ⚠ **Connects to `MONGODB_URI`** — in this project that is the **production database** (see `.env`). No write operations were detected, but check the code before running.
