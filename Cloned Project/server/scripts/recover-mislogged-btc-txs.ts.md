# `server/scripts/recover-mislogged-btc-txs.ts`

> One-shot recovery: find WalletTransactions that were logged against a BTC (or INR / ETH) sibling wallet with `currency: "USD"` (or a currency mismatch in general), rewrite them to the correct USD sibling, and re-derive both wallets' balanc…

**Kind:** backend one-off script (may write to the production DB) · **Lines:** 213

<!-- docgen:auto -->

## Purpose
One-shot recovery: find WalletTransactions that were logged against a
BTC (or INR / ETH) sibling wallet with `currency: "USD"` (or a
currency mismatch in general), rewrite them to the correct USD
sibling, and re-derive both wallets' balances from the ledger.

Root cause: legacy `StoreWallet.findOne({userId, orgId})` lookups
across ~20 files return whichever sibling Mongo's compound unique
index sorts first (alphabetically → BTC). Every legacy USD-only
credit / debit / transfer on a cryptobrand org went to the wrong
ledger. Fixed at the schema level via a pre('findOne') hook, but
the historical writes need repair.

Safe to run repeatedly — idempotent. Only touches rows where
`WalletTransaction.currency !== StoreWallet.currency`.

Usage: […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

None — this file exports nothing.

## Interfaces

- **Database (Mongoose models used):**
  - `StoreWallet` (server/models/storeWallet.model.ts) — reads: `find`; **writes:** `create`, `updateOne`
  - `WalletTransaction` (server/models/walletTransaction.model.ts) — reads: `find`; **writes:** `updateOne`
- **Environment variables (`process.env`):** `MONGODB_URI`

## Dependencies

- **Internal:**
  - `server/models/storeWallet.model.ts` — `StoreWallet`
  - `server/models/walletTransaction.model.ts` — `WalletTransaction`
  - `server/models/organization.model.ts` — `Organization`
- **Packages:**
  - `dotenv`
  - `mongoose`

## Used by

Entry: run by hand: `npx tsx server/scripts/recover-mislogged-btc-txs.ts`.

## Notes

- ⚠ **Connects to `MONGODB_URI`** — in this project that is the **production database** (see `.env`). It performs write operations: `StoreWallet` (create, updateOne); `WalletTransaction` (updateOne).
- Command-line flags referenced: `--dry-run`.
