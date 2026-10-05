# `server/scripts/audit-whitelabel-state.ts`

> Post-reversal audit: verifies that the reverted invoice, wallets, and OfficeAddonSubscription docs are all in the expected end-state.

**Kind:** backend one-off script (may write to the production DB) · **Lines:** 223

<!-- docgen:auto -->

## Purpose
Post-reversal audit: verifies that the reverted invoice, wallets,
and OfficeAddonSubscription docs are all in the expected end-state.

Doesn't mutate anything — pure inspection.

Usage:
  npx tsx src/scripts/audit-whitelabel-state.ts

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

None — this file exports nothing.

## Interfaces

- **Database (Mongoose models used):**
  - `Invoice` (server/models/invoice.model.ts) — reads: `findById`
  - `WalletTransaction` (server/models/walletTransaction.model.ts) — reads: `findOne`, `find`
  - `User` (server/models/user.model.ts) — reads: `findOne`
  - `StoreWallet` (server/models/storeWallet.model.ts) — reads: `findOne`
  - `OfficeAddon` (server/models/officeAddon.model.ts) — reads: `findOne`
  - `OfficeAddonSubscription` (server/models/officeAddonSubscription.model.ts) — reads: `findOne`, `find`
- **Environment via `server/config/env.ts`:** `env.MONGODB_URI`

## Dependencies

- **Internal:**
  - `server/config/env.ts` — `env`
  - `server/models/invoice.model.ts` — `Invoice`
  - `server/models/storeWallet.model.ts` — `StoreWallet`
  - `server/models/walletTransaction.model.ts` — `WalletTransaction`
  - `server/models/user.model.ts` — `User`
  - `server/models/officeAddon.model.ts` — `OfficeAddon`
  - `server/models/officeAddonSubscription.model.ts` — `OfficeAddonSubscription`
  - `server/models/organization.model.ts` — `Organization`
  - `server/config/whitelabelAddon.ts` — `WHITELABEL_ADDON`
  - `server/services/commission.ts` — `PLATFORM_USER_EMAIL`, `PLATFORM_ORG_ID`
- **Packages:**
  - `dotenv`
  - `mongoose` — `Types`

## Used by

Entry: run by hand: `npx tsx server/scripts/audit-whitelabel-state.ts`.

## Notes

- ⚠ **Connects to `MONGODB_URI`** — in this project that is the **production database** (see `.env`). No write operations were detected, but check the code before running.
