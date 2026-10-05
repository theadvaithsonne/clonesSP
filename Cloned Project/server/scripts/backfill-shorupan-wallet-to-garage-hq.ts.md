# `server/scripts/backfill-shorupan-wallet-to-garage-hq.ts`

> Pass 2 migration — one-shot backfill of shorupan@gmail.com's legacy user-scoped wallet data into the GARAGE HQ org's AivatarWallet.

**Kind:** backend one-off script (may write to the production DB) · **Lines:** 115

<!-- docgen:auto -->

## Purpose
Pass 2 migration — one-shot backfill of shorupan@gmail.com's legacy
user-scoped wallet data into the GARAGE HQ org's AivatarWallet.

Run manually before the wallet branch (feat/first-office-bonus) merges
to prod. After merge, the legacy garage_agent_wallets collection
becomes orphaned and this data would never be reachable.

The legacy `Wallet` model file was already deleted in the wallet
refactor, so we read its docs via raw collection access instead of
a Mongoose model.

Idempotent: re-running after a successful pass does nothing
(checks the legacy doc's `migratedAt` field).

Usage (from roam-backend/):
  npx ts-node src/scripts/backfill-shorupan-wallet-to-garage-hq.ts

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

None — this file exports nothing.

## Interfaces

- **Database (Mongoose models used):**
  - `User` (server/models/user.model.ts) — reads: `findOne`
  - `Organization` (server/models/organization.model.ts) — reads: `findOne`
  - `AivatarWallet` (server/models/aivatarWallet.model.ts) — reads: `findOne`; **writes:** `create`, `updateOne`
- **Environment via `server/config/env.ts`:** `env.MONGODB_URI`

## Dependencies

- **Internal:**
  - `server/config/env.ts` — `env`
  - `server/models/user.model.ts` — `User`
  - `server/models/organization.model.ts` — `Organization`
  - `server/models/aivatarWallet.model.ts` — `AivatarWallet`
- **Packages:**
  - `dotenv`
  - `mongoose`

## Used by

Entry: run by hand: `npx tsx server/scripts/backfill-shorupan-wallet-to-garage-hq.ts`.

## Notes

- ⚠ **Connects to `MONGODB_URI`** — in this project that is the **production database** (see `.env`). It performs write operations: `AivatarWallet` (create, updateOne).
