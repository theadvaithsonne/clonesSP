# `server/scripts/retro-migrate-cascade-to-up.ts`

> One-shot: migrate a whitelabel/cryptosub invoice from the old depth-weighted cascade + platform-absorbed layout to the new UP-formula cascade layout.

**Kind:** backend one-off script (may write to the production DB) · **Lines:** 286

<!-- docgen:auto -->

## Purpose
One-shot: migrate a whitelabel/cryptosub invoice from the old
depth-weighted cascade + platform-absorbed layout to the new
UP-formula cascade layout.

For the ONE invoice already paid before the fix:
  - Reverses the old cascade credits (L1..L6 depth-weighted).
  - Reverses the old platform residual (which had L4..L6 absorbed).
  - Runs distributeUnilevelPlusCommission on the $144 pool for the fresh split.
  - Credits the new $6 baseline platform residual.
  - Leaves the $150 direct AND the $300 platform revenue untouched
    (both already correct under both models).

Idempotent — checks if the UP distribution already exists for the invoice.

Usage:
  npx tsx src/scripts/retro-migrate-cascade-to-up.ts <invoiceId>

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

None — this file exports nothing.

## Interfaces

- **Database (Mongoose models used):**
  - `Invoice` (server/models/invoice.model.ts) — reads: `findById`; **writes:** `updateOne`
  - `UnilevelPlusDistribution` (server/models/unilevelPlusDistribution.model.ts) — reads: `findOne`
  - `WalletTransaction` (server/models/walletTransaction.model.ts) — reads: `find`, `findOne`; **writes:** `create`
  - `AffiliateWallet` (server/models/affiliateWallet.model.ts) — reads: `findById`
  - `StoreWallet` (server/models/storeWallet.model.ts) — reads: `findById`, `findOne`
  - `User` (server/models/user.model.ts) — reads: `findOne`
  - `UnilevelPlusPlan` (server/models/unilevelPlusPlan.model.ts) — reads: `findOne`
- **Environment via `server/config/env.ts`:** `env.MONGODB_URI`

## Dependencies

- **Internal:**
  - `server/config/env.ts` — `env`
  - `server/models/invoice.model.ts` — `Invoice`
  - `server/models/storeWallet.model.ts` — `StoreWallet`
  - `server/models/affiliateWallet.model.ts` — `AffiliateWallet`
  - `server/models/walletTransaction.model.ts` — `WalletTransaction`
  - `server/models/user.model.ts` — `User`
  - `server/models/unilevelPlusPlan.model.ts` — `UnilevelPlusPlan`
  - `server/models/unilevelPlusDistribution.model.ts` — `UnilevelPlusDistribution`
  - `server/services/commission.ts` — `PLATFORM_USER_EMAIL`, `PLATFORM_ORG_ID`
  - `server/config/whitelabelAddon.ts` — `WHITELABEL_ADDON`
  - `server/config/cryptosubAddon.ts` — `CRYPTOSUB_ADDON`
- **Packages:**
  - `dotenv`
  - `mongoose` — `Types`

## Used by

Entry: run by hand: `npx tsx server/scripts/retro-migrate-cascade-to-up.ts`.

## Notes

- ⚠ **Connects to `MONGODB_URI`** — in this project that is the **production database** (see `.env`). It performs write operations: `Invoice` (updateOne); `WalletTransaction` (create).
