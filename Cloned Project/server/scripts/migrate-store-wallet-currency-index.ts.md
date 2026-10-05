# `server/scripts/migrate-store-wallet-currency-index.ts`

> One-shot migration: swap the StoreWallet unique index from `(userId, orgId)` → `(userId, orgId, currency)`.

**Kind:** backend one-off script (may write to the production DB) · **Lines:** 78

<!-- docgen:auto -->

## Purpose
One-shot migration: swap the StoreWallet unique index from
`(userId, orgId)` → `(userId, orgId, currency)`.

Why: pre-migration, the compound-unique on `(userId, orgId)`
literally prevented multi-currency wallets from coexisting for the
same user in the same org. The cryptobrand multi-currency feature
needs to hold USD + INR + ETH + BTC side by side.

Safety: NEVER changes any wallet document. Only touches indexes.
Idempotent — re-running after the first successful run does
nothing (checks existing index shape first).

Usage (from roam-backend/):
  npx tsx src/scripts/migrate-store-wallet-currency-index.ts

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

None — this file exports nothing.

## Interfaces

- **Environment via `server/config/env.ts`:** `env.MONGODB_URI`

## Dependencies

- **Internal:**
  - `server/config/env.ts` — `env`
  - `server/models/storeWallet.model.ts` — `StoreWallet`
- **Packages:**
  - `dotenv`
  - `mongoose`

## Used by

Entry: run by hand: `npx tsx server/scripts/migrate-store-wallet-currency-index.ts`.

## Notes

- ⚠ **Connects to `MONGODB_URI`** — in this project that is the **production database** (see `.env`). No write operations were detected, but check the code before running.
