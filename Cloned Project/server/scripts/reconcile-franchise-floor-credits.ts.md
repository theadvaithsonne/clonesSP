# `server/scripts/reconcile-franchise-floor-credits.ts`

> Reconcile the "franchise floor" credit for every paid franchise_program / franchise_territory invoice that was paid via store_wallet.

**Kind:** backend one-off script (may write to the production DB) · **Lines:** 174

<!-- docgen:auto -->

## Purpose
Reconcile the "franchise floor" credit for every paid franchise_program
/ franchise_territory invoice that was paid via store_wallet.

Background:
  The fulfilment code for `franchise_program` and `franchise_territory`
  was written assuming payment-gateway settlement — the $650 floor lands
  in the platform's bank externally, no internal wallet split needed.
  For `paymentPlatform: "store_wallet"` invoices, the buyer's wallet is
  debited but nothing credits the platform wallet, so the money vanishes
  from the internal ledger.

  Code fix landed in services/invoice.ts (franchise_program +
  franchise_territory case blocks) — future invoices credit the floor
  at fulfilment time, tagged with `metadata.franchiseFloor` for
  idempotency.
 […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

None — this file exports nothing.

## Interfaces

- **Database (Mongoose models used):**
  - `User` (server/models/user.model.ts) — reads: `findOne`
  - `WalletTransaction` (server/models/walletTransaction.model.ts) — reads: `findOne`; **writes:** `updateOne`
- **Raw collections:** `invoices`
- **Environment variables (`process.env`):** `MONGODB_URI`

## Dependencies

- **Internal:**
  - `server/models/franchiseProgram.model.ts` — `FRANCHISE_PRICE_USD`
  - `server/services/commission.ts` — `PLATFORM_USER_EMAIL`, `PLATFORM_ORG_ID`
  - `server/models/user.model.ts` — `User`
  - `server/models/walletTransaction.model.ts` — `WalletTransaction`
  - `server/services/wallet.ts` — `creditStoreWallet`
- **Packages:**
  - `dotenv`
  - `mongoose`

## Used by

Entry: run by hand: `npx tsx server/scripts/reconcile-franchise-floor-credits.ts`.

## Notes

- ⚠ **Connects to `MONGODB_URI`** — in this project that is the **production database** (see `.env`). It performs write operations: `WalletTransaction` (updateOne).
- Command-line flags referenced: `--apply`.
