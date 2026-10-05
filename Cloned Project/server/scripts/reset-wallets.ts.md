# `server/scripts/reset-wallets.ts`

> Reset script to wipe all wallet balances, transactions, and commission distributions.

**Kind:** backend one-off script (may write to the production DB) · **Lines:** 87

<!-- docgen:auto -->

## Purpose
Reset script to wipe all wallet balances, transactions, and commission distributions.
Use this when migrating currency (e.g., INR -> USD) to start fresh.

This script will:
1. Reset all AffiliateWallet balances to 0 (and currency to USD)
2. Reset all StoreWallet balances to 0 (and currency to USD)
3. Delete all WalletTransaction records
4. Delete all CommissionDistribution records
5. Delete all UnilevelPlusDistribution records

Run: npx ts-node src/scripts/reset-wallets.ts

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

None — this file exports nothing.

## Interfaces

- **Database (Mongoose models used):**
  - `AffiliateWallet` (server/models/affiliateWallet.model.ts) — **writes:** `updateMany`
  - `StoreWallet` (server/models/storeWallet.model.ts) — **writes:** `updateMany`
  - `WalletTransaction` (server/models/walletTransaction.model.ts) — **writes:** `deleteMany`
  - `CommissionDistribution` (server/models/commissionDistribution.model.ts) — **writes:** `deleteMany`
  - `UnilevelPlusDistribution` (server/models/unilevelPlusDistribution.model.ts) — **writes:** `deleteMany`
- **Environment variables (`process.env`):** `MONGODB_URI`

## Dependencies

- **Internal:**
  - `server/models/affiliateWallet.model.ts` — `AffiliateWallet`
  - `server/models/storeWallet.model.ts` — `StoreWallet`
  - `server/models/walletTransaction.model.ts` — `WalletTransaction`
  - `server/models/commissionDistribution.model.ts` — `CommissionDistribution`
  - `server/models/unilevelPlusDistribution.model.ts` — `UnilevelPlusDistribution`
- **Packages:**
  - `mongoose`
  - `dotenv`

## Used by

Entry: run by hand: `npx tsx server/scripts/reset-wallets.ts`.

## Notes

- ⚠ **Connects to `MONGODB_URI`** — in this project that is the **production database** (see `.env`). It performs write operations: `AffiliateWallet` (updateMany); `StoreWallet` (updateMany); `WalletTransaction` (deleteMany); `CommissionDistribution` (deleteMany); `UnilevelPlusDistribution` (deleteMany).
