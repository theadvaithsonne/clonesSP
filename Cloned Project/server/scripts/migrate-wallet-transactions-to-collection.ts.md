# `server/scripts/migrate-wallet-transactions-to-collection.ts`

> Pass 1 migration — move every existing AivatarWallet's inline transactions[] field into the garage_aivatar_wallet_transactions collection.

**Kind:** backend one-off script (may write to the production DB) · **Lines:** 99

<!-- docgen:auto -->

## Purpose
Pass 1 migration — move every existing AivatarWallet's inline
transactions[] field into the garage_aivatar_wallet_transactions
collection.

Run AFTER the wallet-admin-panel branch ships to prod. The new
AivatarWallet model dropped the inline field, so any pre-existing
transactions live in MongoDB but are unreachable via the model. We
read them via the raw collection.

Idempotent: re-running checks for duplicates by (walletId, createdAt,
amount, type) and skips already-migrated rows.

Usage (from roam-backend/):
  npx ts-node src/scripts/migrate-wallet-transactions-to-collection.ts

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

None — this file exports nothing.

## Interfaces

- **Database (Mongoose models used):**
  - `AivatarWalletTransaction` (server/models/aivatarWalletTransaction.model.ts) — reads: `findOne`; **writes:** `create`
- **Raw collections:** `garage_aivatar_wallets`
- **Environment via `server/config/env.ts`:** `env.MONGODB_URI`

## Dependencies

- **Internal:**
  - `server/config/env.ts` — `env`
  - `server/models/aivatarWalletTransaction.model.ts` — `AivatarWalletTransaction`
- **Packages:**
  - `dotenv`
  - `mongoose`

## Used by

Entry: run by hand: `npx tsx server/scripts/migrate-wallet-transactions-to-collection.ts`.

## Notes

- ⚠ **Connects to `MONGODB_URI`** — in this project that is the **production database** (see `.env`). It performs write operations: `AivatarWalletTransaction` (create).
