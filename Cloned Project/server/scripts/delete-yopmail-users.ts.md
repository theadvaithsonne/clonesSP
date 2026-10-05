# `server/scripts/delete-yopmail-users.ts`

> Delete yopmail test users + their owned data, EXCEPT the 21 addresses in the KEEP list.

**Kind:** backend one-off script (may write to the production DB) · **Lines:** 188

<!-- docgen:auto -->

## Purpose
Delete yopmail test users + their owned data, EXCEPT the 21
addresses in the KEEP list.

Two modes:
  --dry-run  (default) → counts every affected doc, writes nothing
  --commit           → actually deletes

Scope per deleted user:
  1. User doc itself
  2. StoreWallet + AffiliateWallet by userId
  3. WalletTransaction rows where userId matches
  4. Invoice where userId (buyer) matches
  5. OfficeSubscription where founderId matches
  6. OfficeAddonSubscription where founderId matches

DELIBERATELY OUT OF SCOPE (would need a separate script if wanted): […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

None — this file exports nothing.

## Interfaces

- **Database (Mongoose models used):**
  - `User` (server/models/user.model.ts) — reads: `find`; **writes:** `deleteMany`
  - `WalletTransaction` (server/models/walletTransaction.model.ts) — reads: `countDocuments`; **writes:** `deleteMany`
  - `StoreWallet` (server/models/storeWallet.model.ts) — reads: `countDocuments`; **writes:** `deleteMany`
  - `AffiliateWallet` (server/models/affiliateWallet.model.ts) — reads: `countDocuments`; **writes:** `deleteMany`
  - `Invoice` (server/models/invoice.model.ts) — reads: `countDocuments`; **writes:** `deleteMany`
  - `OfficeSubscription` (server/models/officeSubscription.model.ts) — reads: `countDocuments`; **writes:** `deleteMany`
  - `OfficeAddonSubscription` (server/models/officeAddonSubscription.model.ts) — reads: `countDocuments`; **writes:** `deleteMany`
- **Environment via `server/config/env.ts`:** `env.MONGODB_URI`
- **Filesystem writes:** `writeFileSync(outFile)` (L102)

## Dependencies

- **Internal:**
  - `server/config/env.ts` — `env`
  - `server/models/user.model.ts` — `User`
  - `server/models/storeWallet.model.ts` — `StoreWallet`
  - `server/models/affiliateWallet.model.ts` — `AffiliateWallet`
  - `server/models/walletTransaction.model.ts` — `WalletTransaction`
  - `server/models/invoice.model.ts` — `Invoice`
  - `server/models/officeSubscription.model.ts` — `OfficeSubscription`
  - `server/models/officeAddonSubscription.model.ts` — `OfficeAddonSubscription`
- **Packages:**
  - `dotenv`
  - `mongoose` — `Types`

## Used by

Entry: run by hand: `npx tsx server/scripts/delete-yopmail-users.ts`.

## Notes

- ⚠ **Connects to `MONGODB_URI`** — in this project that is the **production database** (see `.env`). It performs write operations: `User` (deleteMany); `WalletTransaction` (deleteMany); `StoreWallet` (deleteMany); `AffiliateWallet` (deleteMany); `Invoice` (deleteMany); `OfficeSubscription` (deleteMany); `OfficeAddonSubscription` (deleteMany).
- Command-line flags referenced: `--commit`.
