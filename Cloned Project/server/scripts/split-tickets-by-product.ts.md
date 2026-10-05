# `server/scripts/split-tickets-by-product.ts`

> One-shot data move: the shared `roam-admin-prod.tickets` collection has been used by both Garage and NetworkChain (same Mongo cluster + DB across the two products).

**Kind:** backend one-off script (may write to the production DB) · **Lines:** 115

<!-- docgen:auto -->

## Purpose
One-shot data move: the shared `roam-admin-prod.tickets` collection
has been used by both Garage and NetworkChain (same Mongo cluster
+ DB across the two products). We split into two dedicated
collections going forward:
  - `tickets_garage`          ← all current `tickets` docs (verified
                                 to be 100% Garage at run time)
  - `tickets_networkchain`    ← stays empty, NC code now writes here

The Ticket model in both repos has been re-pointed via mongoose's
3rd `collectionName` arg, so post-deploy both backends write to the
right place.

Usage:
  npx tsx src/scripts/split-tickets-by-product.ts          # dry run
  npx tsx src/scripts/split-tickets-by-product.ts --apply  # write

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

None — this file exports nothing.

## Interfaces

- **Raw collections:** `tickets`, `tickets_garage`
- **Environment via `server/config/env.ts`:** `env.MONGODB_URI`

## Dependencies

- **Internal:**
  - `server/config/env.ts` — `env`
- **Packages:**
  - `mongoose`
  - `dotenv`

## Used by

Entry: run by hand: `npx tsx server/scripts/split-tickets-by-product.ts`.

## Notes

- ⚠ **Connects to `MONGODB_URI`** — in this project that is the **production database** (see `.env`). No write operations were detected, but check the code before running.
- Command-line flags referenced: `--apply`.
