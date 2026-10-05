# `server/scripts/move-unilevel-commission.ts`

> Re-point a member's ALREADY-PAID Unilevel Plus commission at their new upline.

**Kind:** backend one-off script (may write to the production DB) · **Lines:** 420

<!-- docgen:auto -->

## Purpose
Re-point a member's ALREADY-PAID Unilevel Plus commission at their new upline.

`POST /garage-admin/users/:id/move-upline` deliberately only affects FUTURE
commissions — the historical ledger is immutable by design. When an admin
moves someone whose $25 UP purchase has already distributed, the payout still
follows the old chain. This script performs that correction.

WHAT IT DOES
  1. Reverses every wallet transaction the original distribution created,
     by posting opposite entries. The original transactions and the original
     distribution's recipient arrays are never mutated — the audit trail is
     append-only. The distribution is marked status: "reversed".
  2. Re-runs distributeUnilevelPlusCommission against the CURRENT tree, under
     a fresh paymentId, carrying metadata.supersedes.

This is NOT zero-sum. A buyer who sat near the tree root had most of the […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

None — this file exports nothing.

## Interfaces

- **Database (Mongoose models used):**
  - `User` (server/models/user.model.ts) — reads: `findOne`, `findById`
  - `UnilevelPlusDistribution` (server/models/unilevelPlusDistribution.model.ts) — reads: `find`, `findById`; **writes:** `updateOne`
  - `WalletTransaction` (server/models/walletTransaction.model.ts) — reads: `find`; **writes:** `create`, `deleteMany`
  - `AffiliateWallet` (server/models/affiliateWallet.model.ts) — reads: `findById`
  - `StoreWallet` (server/models/storeWallet.model.ts) — reads: `findById`
- **Environment via `server/config/env.ts`:** `env.MONGODB_URI`

## Dependencies

- **Internal:**
  - `server/config/env.ts` — `env`
  - `server/models/user.model.ts` — `User`
  - `server/models/affiliateWallet.model.ts` — `AffiliateWallet`
  - `server/models/storeWallet.model.ts` — `StoreWallet`
  - `server/models/walletTransaction.model.ts` — `WalletTransaction`
  - `server/models/unilevelPlusDistribution.model.ts` — `UnilevelPlusDistribution`
  - `server/services/unilevelPlusCommission.ts` — `distributeUnilevelPlusCommission`
- **Packages:**
  - `dotenv`
  - `mongoose` — `Types`

## Used by

Entry: run by hand: `npx tsx server/scripts/move-unilevel-commission.ts`.

## Notes

- ⚠ **Connects to `MONGODB_URI`** — in this project that is the **production database** (see `.env`). It performs write operations: `UnilevelPlusDistribution` (updateOne); `WalletTransaction` (create, deleteMany).
- Command-line flags referenced: `--confirm`.
