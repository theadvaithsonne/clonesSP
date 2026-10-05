# `server/scripts/diagnoseAuctionSettlement.ts`

> READ-ONLY diagnostic for "the auction was won but the seller's wallet is empty".

**Kind:** backend one-off script (may write to the production DB) · **Lines:** 475

<!-- docgen:auto -->

## Purpose
READ-ONLY diagnostic for "the auction was won but the seller's wallet is
empty".

Walks the whole chain in the order it is supposed to happen and prints what
it finds at each stage, so the first missing/failed link is obvious:

  Product → StoreBid → AuctionEscrow → AuctionSettlement
    → Invoice → ProductOrder → CommissionDistribution
    → seller StoreWallet / platform StoreWallet / buyer AuctionWallet

Then it reconciles the money for the winning bid and states a verdict.

This script NEVER writes. Safe to run against production.

Usage (from garagenew-backend/):
  npm run auction:diagnose -- --product <storeproductId> […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

None — this file exports nothing.

## Interfaces

- **Database (Mongoose models used):**
  - `AuctionSettlement` (server/models/auctionSettlement.model.ts) — reads: `findById`, `findOne`, `find`
  - `StoreProduct` (server/models/storeProduct.model.ts) — reads: `findById`
  - `AuctionEscrow` (server/models/auctionEscrow.model.ts) — reads: `find`
  - `User` (server/models/user.model.ts) — reads: `findOne`
  - `Invoice` (server/models/invoice.model.ts) — reads: `findOne`
  - `ProductOrder` (server/models/productOrder.model.ts) — reads: `findOne`
  - `CommissionDistribution` (server/models/commissionDistribution.model.ts) — reads: `find`
  - `StoreWallet` (server/models/storeWallet.model.ts) — reads: `findOne`
  - `WalletTransaction` (server/models/walletTransaction.model.ts) — reads: `find`
  - `AuctionWallet` (server/models/auctionWallet.model.ts) — reads: `findOne`
  - `AuctionWalletTransaction` (server/models/auctionWalletTransaction.model.ts) — reads: `find`
- **Raw collections:** `storeBids`
- **Environment via `server/config/env.ts`:** `env.MONGODB_URI`

## Dependencies

- **Internal:**
  - `server/config/env.ts` — `env`
  - `server/models/auctionEscrow.model.ts` — `AuctionEscrow`
  - `server/models/auctionSettlement.model.ts` — `AuctionSettlement`
  - `server/models/auctionWallet.model.ts` — `AuctionWallet`
  - `server/models/auctionWalletTransaction.model.ts` — `AuctionWalletTransaction`
  - `server/models/storeProduct.model.ts` — `StoreProduct`
  - `server/models/storeWallet.model.ts` — `StoreWallet`
  - `server/models/walletTransaction.model.ts` — `WalletTransaction`
  - `server/models/commissionDistribution.model.ts` — `CommissionDistribution`
  - `server/models/invoice.model.ts` — `Invoice`
  - `server/models/productOrder.model.ts` — `ProductOrder`
  - `server/models/user.model.ts` — `User`
  - `server/services/commission.ts` — `PLATFORM_USER_EMAIL`, `PLATFORM_ORG_ID`
- **Packages:**
  - `dotenv`
  - `mongoose` — `Types`

## Used by

Entry: run through `npm run auction:diagnose`.

## Notes

- ⚠ **Connects to `MONGODB_URI`** — in this project that is the **production database** (see `.env`). No write operations were detected, but check the code before running.
- Command-line flags referenced: `--recent`.
