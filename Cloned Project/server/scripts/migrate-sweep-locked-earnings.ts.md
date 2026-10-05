# `server/scripts/migrate-sweep-locked-earnings.ts`

> Migration script to sweep locked affiliate earnings to Shorupan's platform wallet.

**Kind:** backend one-off script (may write to the production DB) · **Lines:** 221

<!-- docgen:auto -->

## Purpose
Migration script to sweep locked affiliate earnings to Shorupan's platform wallet.

For every user who has NOT purchased the Unilevel Plus Plan and has a positive
affiliate wallet balance, credit that full balance to Shorupan's StoreWallet.
The user's affiliate wallet balance is NOT changed (it remains as a visual number).

This is a one-time migration to backfill the routing that was added in the
creditAffiliateOrPlatform() helper for all new commissions going forward.

Run: npx ts-node src/scripts/migrate-sweep-locked-earnings.ts

DRY RUN (default): Set DRY_RUN=true or omit to only log what would happen.
LIVE RUN: Set DRY_RUN=false to actually execute.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `sweepLockedEarnings` | function | `async sweepLockedEarnings(): Promise<MigrationStats>` | 220 |

## Interfaces

- **Database (Mongoose models used):**
  - `User` (server/models/user.model.ts) — reads: `findOne`
  - `UnilevelPlusPurchase` (server/models/unilevelPlusPurchase.model.ts) — reads: `find`
  - `AffiliateWallet` (server/models/affiliateWallet.model.ts) — reads: `find`
  - `StoreWallet` (server/models/storeWallet.model.ts) — reads: `findOne`; **writes:** `create`
  - `WalletTransaction` (server/models/walletTransaction.model.ts) — **writes:** `create`
- **Environment variables (`process.env`):** `DRY_RUN`, `MONGODB_URI`

## Dependencies

- **Internal:**
  - `server/models/affiliateWallet.model.ts` — `AffiliateWallet`
  - `server/models/unilevelPlusPurchase.model.ts` — `UnilevelPlusPurchase`
  - `server/models/storeWallet.model.ts` — `StoreWallet`
  - `server/models/walletTransaction.model.ts` — `WalletTransaction`
  - `server/models/user.model.ts` — `User`
- **Packages:**
  - `mongoose`
  - `dotenv`

## Used by

Entry: run by hand: `npx tsx server/scripts/migrate-sweep-locked-earnings.ts`.

## Notes

- ⚠ **Connects to `MONGODB_URI`** — in this project that is the **production database** (see `.env`). It performs write operations: `StoreWallet` (create); `WalletTransaction` (create).
