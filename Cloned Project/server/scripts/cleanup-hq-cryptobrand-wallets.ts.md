# `server/scripts/cleanup-hq-cryptobrand-wallets.ts`

> One-shot: delete every zero-balance non-USD StoreWallet in Garage HQ that got eagerly created because HQ was flagged officeCreatedFromCryptobrand: true.

**Kind:** backend one-off script (may write to the production DB) · **Lines:** 117

<!-- docgen:auto -->

## Purpose
One-shot: delete every zero-balance non-USD StoreWallet in Garage
HQ that got eagerly created because HQ was flagged
officeCreatedFromCryptobrand: true. The USD wallet in HQ is the
PLATFORM-WIDE parent every user has — NEVER touched. Any non-USD
wallet with balance > 0 is left alone (a founder had 4.52 INR +
0.00007472 BTC — those were consolidated to USD in the previous
script; if any others turn up now, they still stay).

Only affects orgId = HQ. Wallets in the 22 real cryptobrand
offices are untouched (different orgId).

USAGE:
  npx tsx src/scripts/cleanup-hq-cryptobrand-wallets.ts          (dry-run)
  npx tsx src/scripts/cleanup-hq-cryptobrand-wallets.ts --live   (execute)

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

None — this file exports nothing.

## Interfaces

- **Database (Mongoose models used):**
  - `StoreWallet` (server/models/storeWallet.model.ts) — reads: `countDocuments`, `distinct`, `find`; **writes:** `deleteMany`
- **Environment variables (`process.env`):** `MONGODB_URI`

## Dependencies

- **Internal:**
  - `server/models/storeWallet.model.ts` — `StoreWallet`
- **Packages:**
  - `mongoose`

## Used by

Entry: run by hand: `npx tsx server/scripts/cleanup-hq-cryptobrand-wallets.ts`.

## Notes

- ⚠ **Connects to `MONGODB_URI`** — in this project that is the **production database** (see `.env`). It performs write operations: `StoreWallet` (deleteMany).
- Command-line flags referenced: `--live`.
