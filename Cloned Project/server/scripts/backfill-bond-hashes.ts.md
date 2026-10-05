# `server/scripts/backfill-bond-hashes.ts`

> Give every existing bond holding a public bond hash, and create the unique index that guarantees no two bonds share one.

**Kind:** backend one-off script (may write to the production DB) · **Lines:** 77

<!-- docgen:auto -->

## Purpose
Give every existing bond holding a public bond hash, and create the
unique index that guarantees no two bonds share one.

autoIndex is OFF in production (src/db/mongo.ts), so the index
declared on the schema is NOT built on deploy. This creates it with
exactly the schema's key, options and name ("bondHash_1"), so a later
`npm run indexes:sync` treats it as already present.

Idempotent: holdings that already have a hash are left alone; the
index create is a no-op if it exists. Dry-run by default.

  ./node_modules/.bin/tsx -r dotenv/config src/scripts/backfill-bond-hashes.ts [--apply]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

None — this file exports nothing.

## Interfaces

- **Raw collections:** `bond_holdings`
- **Environment variables (`process.env`):** `MONGODB_URI`

## Dependencies

- **Internal:**
  - `server/services/bondHash.ts` — `generateBondHash`
- **Packages:**
  - `dotenv`
  - `mongoose`

## Used by

Entry: run by hand: `npx tsx server/scripts/backfill-bond-hashes.ts`.

## Notes

- ⚠ **Connects to `MONGODB_URI`** — in this project that is the **production database** (see `.env`). No write operations were detected, but check the code before running.
- Command-line flags referenced: `--apply`.
