# `server/scripts/_convert-shorupan-hq-to-usd.ts`

> One-shot: convert Shorupan's non-USD balances in Garage HQ (INR 4.52 + BTC 0.00007472) to USD at live spot rate and credit his HQ USD wallet.

**Kind:** backend one-off script (may write to the production DB) · **Lines:** 239

<!-- docgen:auto -->

## Purpose
One-shot: convert Shorupan's non-USD balances in Garage HQ
(INR 4.52 + BTC 0.00007472) to USD at live spot rate and credit
his HQ USD wallet. Debits the source wallets to 0 so the HQ
cleanup script's `balance: 0` guard subsequently deletes them.

Writes three WalletTransaction rows for the audit trail:
  1. INR debit (4.52 INR → 0)
  2. BTC debit (0.00007472 BTC → 0)
  3. USD credit (sum of both conversions)

All three rows carry `metadata.kind: "hq_cryptobrand_cleanup"` so
they're distinguishable in the ledger from user-initiated
conversions. dedupeKey guards against re-runs.

USAGE:
  npx tsx src/scripts/_convert-shorupan-hq-to-usd.ts            (dry-run) […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

None — this file exports nothing.

## Interfaces

- **Database (Mongoose models used):**
  - `StoreWallet` (server/models/storeWallet.model.ts) — reads: `find`; **writes:** `updateOne`
  - `WalletTransaction` (server/models/walletTransaction.model.ts) — **writes:** `create`
- **Environment variables (`process.env`):** `MONGODB_URI`

## Dependencies

- **Internal:**
  - `server/models/storeWallet.model.ts` — `StoreWallet`
  - `server/models/walletTransaction.model.ts` — `WalletTransaction`
  - `server/services/cryptoFxRate.ts` — `getUsdPerCoin`
  - `server/utils/exchangeRate.ts` — `convertInrToUsd`
- **Packages:**
  - `crypto`
  - `mongoose` — `Types`

## Used by

Entry: run by hand: `npx tsx server/scripts/_convert-shorupan-hq-to-usd.ts`.

## Notes

- ⚠ **Connects to `MONGODB_URI`** — in this project that is the **production database** (see `.env`). It performs write operations: `StoreWallet` (updateOne); `WalletTransaction` (create).
- Command-line flags referenced: `--live`.
