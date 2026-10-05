# `server/scripts/backfill-user-crypto-addresses.ts`

> ONE-SHOT MIGRATION: backfill persistent per-user crypto deposit addresses for every existing cryptobrand-org member.

**Kind:** backend one-off script (may write to the production DB) · **Lines:** 162

<!-- docgen:auto -->

## Purpose
ONE-SHOT MIGRATION: backfill persistent per-user crypto deposit
addresses for every existing cryptobrand-org member.

WHAT: iterates every member of every Organization where
`officeCreatedFromCryptobrand === true` and, for each user, calls
`allocateUserAddressesFor(userId, orgId)`. That provisions the 5
UserCryptoAddress rows (BTC × 1, ETH × 1, USDT × 3 chains).

SAFETY:
  • Idempotent. Users who already have all 5 rows are skipped in
    the allocator itself; running this twice is a no-op after the
    first successful pass.
  • Fires HD counter increments. Consumes ~5 indices per user
    (fewer if some already exist). On a 500-member cryptobrand
    population, expect ~2,500 total counter increments spread
    across BTC / EVM / Tron trees. […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Model `UserCryptoAddress`

- **Collection:** `usercryptoaddresses`
- **Schema options:** `strict: false`

| Field | Type | Flags |
|---|---|---|

## Exports

None — this file exports nothing.

## Interfaces

- **Database (Mongoose models used):**
  - `Organization` (server/models/organization.model.ts) — reads: `find`
  - `User` (server/models/user.model.ts) — reads: `find`
  - `StoreWallet` (server/models/storeWallet.model.ts) — reads: `countDocuments`
- **Environment variables (`process.env`):** `MONGODB_URI`

## Dependencies

- **Internal:**
  - `server/models/organization.model.ts` — `Organization`
  - `server/models/user.model.ts` — `User`
  - `server/models/storeWallet.model.ts` — `StoreWallet`
  - `server/services/cryptobrandWallets.ts` — `ensureCryptobrandWallets`
- **Packages:**
  - `mongoose`

## Used by

Entry: run by hand: `npx tsx server/scripts/backfill-user-crypto-addresses.ts`.

## Notes

- ⚠ **Connects to `MONGODB_URI`** — in this project that is the **production database** (see `.env`). No write operations were detected, but check the code before running.
- Command-line flags referenced: `--dry-run`, `--org`.
