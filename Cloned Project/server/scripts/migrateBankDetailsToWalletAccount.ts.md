# `server/scripts/migrateBankDetailsToWalletAccount.ts`

> One-time migration: copy each legacy per-user BankDetails record into the new per-wallet model as the AFFILIATE wallet's bank account.

**Kind:** backend one-off script (may write to the production DB) · **Lines:** 73

<!-- docgen:auto -->

## Purpose
One-time migration: copy each legacy per-user BankDetails record into the
new per-wallet model as the AFFILIATE wallet's bank account.

Run once per environment:
    npx ts-node src/scripts/migrateBankDetailsToWalletAccount.ts

Idempotent — upserts on the wallet slot {userId, affiliate, null, bank},
so re-running just refreshes the same rows. The legacy BankDetails
collection is left untouched.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

None — this file exports nothing.

## Interfaces

- **Database (Mongoose models used):**
  - `BankDetails` (server/models/bank-details.model.ts) — reads: `find`
  - `WalletAccount` (server/models/walletAccount.model.ts) — **writes:** `findOneAndUpdate`
- **Environment variables (`process.env`):** `MONGODB_URI`

## Dependencies

- **Internal:**
  - `server/models/bank-details.model.ts` — `BankDetails`
  - `server/models/walletAccount.model.ts` — `WalletAccount`
- **Packages:**
  - `mongoose`
  - `dotenv`

## Used by

Entry: run by hand: `npx tsx server/scripts/migrateBankDetailsToWalletAccount.ts`.

## Notes

- ⚠ **Connects to `MONGODB_URI`** — in this project that is the **production database** (see `.env`). It performs write operations: `WalletAccount` (findOneAndUpdate).
