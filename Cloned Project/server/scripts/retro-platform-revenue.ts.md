# `server/scripts/retro-platform-revenue.ts`

> One-shot: credit the $300 platform-revenue write to Shorupan HQ StoreWallet for a specific whitelabel_addon (or cryptosub) invoice that was fulfilled BEFORE the platform-revenue write was added.

**Kind:** backend one-off script (may write to the production DB) · **Lines:** 146

<!-- docgen:auto -->

## Purpose
One-shot: credit the $300 platform-revenue write to Shorupan HQ
StoreWallet for a specific whitelabel_addon (or cryptosub) invoice
that was fulfilled BEFORE the platform-revenue write was added.

Idempotent via a dedupeKey — running twice is a no-op after the
first success.

Usage:
  npx tsx src/scripts/retro-platform-revenue.ts <invoiceId>

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

None — this file exports nothing.

## Interfaces

- **Database (Mongoose models used):**
  - `Invoice` (server/models/invoice.model.ts) — reads: `findById`
  - `WalletTransaction` (server/models/walletTransaction.model.ts) — reads: `findOne`; **writes:** `create`
  - `User` (server/models/user.model.ts) — reads: `findOne`
  - `StoreWallet` (server/models/storeWallet.model.ts) — reads: `findOne`
- **Environment via `server/config/env.ts`:** `env.MONGODB_URI`

## Dependencies

- **Internal:**
  - `server/config/env.ts` — `env`
  - `server/models/invoice.model.ts` — `Invoice`
  - `server/models/storeWallet.model.ts` — `StoreWallet`
  - `server/models/walletTransaction.model.ts` — `WalletTransaction`
  - `server/models/user.model.ts` — `User`
  - `server/services/commission.ts` — `PLATFORM_USER_EMAIL`, `PLATFORM_ORG_ID`
  - `server/config/whitelabelAddon.ts` — `WHITELABEL_ADDON`
  - `server/config/cryptosubAddon.ts` — `CRYPTOSUB_ADDON`
- **Packages:**
  - `dotenv`
  - `mongoose` — `Types`

## Used by

Entry: run by hand: `npx tsx server/scripts/retro-platform-revenue.ts`.

## Notes

- ⚠ **Connects to `MONGODB_URI`** — in this project that is the **production database** (see `.env`). It performs write operations: `WalletTransaction` (create).
