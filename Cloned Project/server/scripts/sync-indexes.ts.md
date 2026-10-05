# `server/scripts/sync-indexes.ts`

> Manual, deliberate index-sync — the replacement for Mongoose's default autoIndex on prod.

**Kind:** backend one-off script (may write to the production DB) · **Lines:** 132

<!-- docgen:auto -->

## Purpose
Manual, deliberate index-sync — the replacement for Mongoose's
default autoIndex on prod.

With `autoIndex: false` (see src/db/mongo.ts) the app no longer
silently builds indexes on boot. Adding a new index to a schema
has zero effect until this script runs — which is the intended
shape, because on a large collection (WalletTransaction is the
canonical offender) an unexpected `createIndex` at deploy time
pins CPU on the DB and cascades to every wallet endpoint.

Usage:
  # Sync ALL models' indexes:
  npm run indexes:sync

  # Sync a specific model:
  npm run indexes:sync -- WalletTransaction […]

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

Entry: run through `npm run indexes:sync`, `npm run indexes:sync:prod`.

## Notes

- ⚠ **Connects to `MONGODB_URI`** — in this project that is the **production database** (see `.env`). No write operations were detected, but check the code before running.
