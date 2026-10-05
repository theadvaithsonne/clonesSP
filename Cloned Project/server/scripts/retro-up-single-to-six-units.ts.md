# `server/scripts/retro-up-single-to-six-units.ts`

> One-shot: convert a whitelabel/cryptosub invoice's UP cascade from a SINGLE $150 distribution → SIX $25 distributions.

**Kind:** backend one-off script (may write to the production DB) · **Lines:** 370

<!-- docgen:auto -->

## Purpose
One-shot: convert a whitelabel/cryptosub invoice's UP cascade from a
SINGLE $150 distribution → SIX $25 distributions.

Why: UP level bonuses use `points × pointValue` (fixed ¢/point), NOT
a % of saleAmount. A single $150 call paid level bonuses as if the
sale were ONE UP unit. Six $25 calls correctly scale level bonuses 6×.

Also undoes the earlier `retro-pool-delta` script (the +$2.16 shift
from HQ to L1 that only patched UP-direct, not level bonuses).

Steps (all inside one transaction):
  1. Undo retro-pool-delta txs (dedupeKey `<prefix>_pool_delta_<invId>`
     and `<prefix>_pool_delta_<invId>_platform`) if present.
  2. Reverse every WalletTransaction with metadata.distributionId of
     the old single UP distribution — restore each wallet balance.
  3. Mark the old UnilevelPlusDistribution as `reversed` (keep the row […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

None — this file exports nothing.

## Interfaces

- **Database (Mongoose models used):**
  - `Invoice` (server/models/invoice.model.ts) — reads: `findById`; **writes:** `updateOne`
  - `UnilevelPlusDistribution` (server/models/unilevelPlusDistribution.model.ts) — reads: `findOne`; **writes:** `updateOne`
  - `WalletTransaction` (server/models/walletTransaction.model.ts) — reads: `find`; **writes:** `create`
  - `AffiliateWallet` (server/models/affiliateWallet.model.ts) — reads: `findById`
  - `StoreWallet` (server/models/storeWallet.model.ts) — reads: `findById`
  - `UnilevelPlusPlan` (server/models/unilevelPlusPlan.model.ts) — reads: `findOne`
- **Environment via `server/config/env.ts`:** `env.MONGODB_URI`

## Dependencies

- **Internal:**
  - `server/config/env.ts` — `env`
  - `server/models/invoice.model.ts` — `Invoice`
  - `server/models/storeWallet.model.ts` — `StoreWallet`
  - `server/models/affiliateWallet.model.ts` — `AffiliateWallet`
  - `server/models/walletTransaction.model.ts` — `WalletTransaction`
  - `server/models/unilevelPlusPlan.model.ts` — `UnilevelPlusPlan`
  - `server/models/unilevelPlusDistribution.model.ts` — `UnilevelPlusDistribution`
- **Packages:**
  - `dotenv`
  - `mongoose` — `Types`

## Used by

Entry: run by hand: `npx tsx server/scripts/retro-up-single-to-six-units.ts`.

## Notes

- ⚠ **Connects to `MONGODB_URI`** — in this project that is the **production database** (see `.env`). It performs write operations: `Invoice` (updateOne); `UnilevelPlusDistribution` (updateOne); `WalletTransaction` (create).
