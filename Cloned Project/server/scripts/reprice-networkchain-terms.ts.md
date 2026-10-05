# `server/scripts/reprice-networkchain-terms.ts`

> Reprice the NetworkChain multi-month term plans.

**Kind:** backend one-off script (may write to the production DB) · **Lines:** 204

<!-- docgen:auto -->

## Purpose
Reprice the NetworkChain multi-month term plans.

Prices live in Mongo on `ThirdPartyClient.productConfig.termPlans[]`, not in
code, so this is a data change. It edits ONLY the price fields of the terms
named in TARGET_PRICING — `upPortion`, `isActive`, `label` and `sortOrder`
are left exactly as they are, and any term not listed (notably the 1-month
plan) is not touched at all.

WHY NOT seed-networkchain-term-plans.ts:
  That script rewrites the WHOLE array from hardcoded constants which are
  stale relative to production (it derives bundle values as `bundleCart − 25`,
  which no longer matches what is stored), and it writes `isActive: false`
  for 3/6/12 unless `--activate` is passed — silently making them
  unsellable. This script is surgical by comparison.

BOTH PRICE FIELDS MOVE TOGETHER: […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

None — this file exports nothing.

## Interfaces

- **Database (Mongoose models used):**
  - `ThirdPartyClient` (server/models/thirdPartyClient.model.ts) — reads: `find`, `findById`
- **Environment via `server/config/env.ts`:** `env.MONGODB_URI`

## Dependencies

- **Internal:**
  - `server/config/env.ts` — `env`
  - `server/models/thirdPartyClient.model.ts` — `ThirdPartyClient`
- **Packages:**
  - `dotenv`
  - `mongoose`

## Used by

Entry: run by hand: `npx tsx server/scripts/reprice-networkchain-terms.ts`.

## Notes

- ⚠ **Connects to `MONGODB_URI`** — in this project that is the **production database** (see `.env`). No write operations were detected, but check the code before running.
- Command-line flags referenced: `--confirm`.
