# `server/scripts/migrate-wallets.ts`

> Migration script to create wallets for existing users

**Kind:** backend one-off script (may write to the production DB) · **Lines:** 166

<!-- docgen:auto -->

## Purpose
Migration script to create wallets for existing users

Run: npx ts-node src/scripts/migrate-wallets.ts

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `migrateWallets` | function | `async migrateWallets(): Promise<MigrationStats>` | 165 |

## Interfaces

- **Database (Mongoose models used):**
  - `User` (server/models/user.model.ts) — reads: `find`
  - `AffiliateWallet` (server/models/affiliateWallet.model.ts) — reads: `findOne`; **writes:** `create`
  - `StoreWallet` (server/models/storeWallet.model.ts) — reads: `findOne`; **writes:** `create`
- **Environment variables (`process.env`):** `MONGODB_URI`

## Dependencies

- **Internal:**
  - `server/models/user.model.ts` — `User`
  - `server/models/storeWallet.model.ts` — `StoreWallet`
  - `server/models/affiliateWallet.model.ts` — `AffiliateWallet`
- **Packages:**
  - `mongoose`
  - `dotenv`

## Used by

Entry: run by hand: `npx tsx server/scripts/migrate-wallets.ts`.

## Notes

- ⚠ **Connects to `MONGODB_URI`** — in this project that is the **production database** (see `.env`). It performs write operations: `AffiliateWallet` (create); `StoreWallet` (create).
