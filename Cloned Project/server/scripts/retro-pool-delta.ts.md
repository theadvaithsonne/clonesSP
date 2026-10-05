# `server/scripts/retro-pool-delta.ts`

> One-shot targeted delta: adjust a whitelabel/cryptosub invoice from the old $144 cascade pool → new $150 cascade pool.

**Kind:** backend one-off script (may write to the production DB) · **Lines:** 186

<!-- docgen:auto -->

## Purpose
One-shot targeted delta: adjust a whitelabel/cryptosub invoice from
the old $144 cascade pool → new $150 cascade pool.

Delta accounting (per invoice):
  - UP direct bonus: was 36%×$144 = $51.84, now 36%×$150 = $54.00 → +$2.16 to L1
  - UP company/infinity/manager/unallocated: was ~$91.92, now ~$95.76 → +$3.84 to Shorupan HQ
  - UP level bonuses: change by ~$0.01 (rounding), platform absorbs → +$0.01 to Shorupan HQ
  - Platform revenue (seller take): was $300, now $294 → -$6 from Shorupan HQ

Net wallet movement: +$2.16 Ayra, +($3.84 + $0.01 - $6) = -$2.15 Shorupan HQ
Ignoring rounding pennies: $2.16 shifts from Shorupan HQ → L1 recipient.

This script does exactly that: credit L1 +$2.16, debit Shorupan HQ -$2.16.
Idempotent via dedupeKey `<prefix>_pool_delta_<invoiceId>`.

Usage: […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

None — this file exports nothing.

## Interfaces

- **Database (Mongoose models used):**
  - `Invoice` (server/models/invoice.model.ts) — reads: `findById`
  - `WalletTransaction` (server/models/walletTransaction.model.ts) — reads: `findOne`; **writes:** `create`
  - `User` (server/models/user.model.ts) — reads: `findById`, `findOne`
  - `AffiliateWallet` (server/models/affiliateWallet.model.ts) — reads: `findOne`
  - `StoreWallet` (server/models/storeWallet.model.ts) — reads: `findOne`
- **Environment via `server/config/env.ts`:** `env.MONGODB_URI`

## Dependencies

- **Internal:**
  - `server/config/env.ts` — `env`
  - `server/models/invoice.model.ts` — `Invoice`
  - `server/models/affiliateWallet.model.ts` — `AffiliateWallet`
  - `server/models/storeWallet.model.ts` — `StoreWallet`
  - `server/models/walletTransaction.model.ts` — `WalletTransaction`
  - `server/models/user.model.ts` — `User`
  - `server/services/commission.ts` — `PLATFORM_USER_EMAIL`, `PLATFORM_ORG_ID`
- **Packages:**
  - `dotenv`
  - `mongoose` — `Types`

## Used by

Entry: run by hand: `npx tsx server/scripts/retro-pool-delta.ts`.

## Notes

- ⚠ **Connects to `MONGODB_URI`** — in this project that is the **production database** (see `.env`). It performs write operations: `WalletTransaction` (create).
