# `server/routes/walletHq.ts`

> src/routes/walletHq.ts

**Kind:** Express router · **Lines:** 388 · **Mounted at:** `/wallet/hq` (browser: `/backend/wallet/hq`)

<!-- docgen:auto -->

## Purpose
src/routes/walletHq.ts

Internal-only programmatic access to a user's Garage HQ Store Wallet.
"Garage HQ" is the Organization with `parent: true` — exactly one row.
All endpoints are guarded by `requireInternalKey` (X-Internal-Api-Key
header), matching the existing /wallet/internal/* surface used by
Agent-Manager.

Endpoints:
  GET  /wallet/hq/users/:userId/balance
  GET  /wallet/hq/users/:userId/transactions
  GET  /wallet/hq/users/:userId/summary
  POST /wallet/hq/users/:userId/debit

All reads + the debit are scoped to (userId, hqOrgId). The HQ org is
resolved at request time via `Organization.findOne({ parent: true })` — […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (4)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| GET | `/users/:userId/balance` | `/backend/wallet/hq/users/:userId/balance` | `requireInternalKey` | inline | 107 |
| GET | `/users/:userId/transactions` | `/backend/wallet/hq/users/:userId/transactions` | `requireInternalKey` | inline | 162 |
| GET | `/users/:userId/summary` | `/backend/wallet/hq/users/:userId/summary` | `requireInternalKey` | inline | 204 |
| POST | `/users/:userId/debit` | `/backend/wallet/hq/users/:userId/debit` | `requireInternalKey` | inline | 278 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 387 |

## Interfaces

- **Database (Mongoose models used):**
  - `Organization` (server/models/organization.model.ts) — reads: `findOne`
  - `WalletTransaction` (server/models/walletTransaction.model.ts) — reads: `aggregate`, `findOne`; **writes:** `updateOne`

## Dependencies

- **Internal:**
  - `server/middleware/auth.ts` — `requireInternalKey`
  - `server/models/organization.model.ts` — `Organization`
  - `server/models/walletTransaction.model.ts` — `WalletTransaction`
  - `server/services/wallet.ts` — `getStoreWalletBalance`, `getStoreWalletTransactions`, `debitStoreWallet`
  - `server/services/withdrawal.ts` — `getWithdrawableBalanceCents`
- **Packages:**
  - `express` — `Router`, `Request`, `Response`, `NextFunction`
  - `zod` — `z`, `ZodError`
  - `mongoose` — `Types`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/wallet/hq`.
