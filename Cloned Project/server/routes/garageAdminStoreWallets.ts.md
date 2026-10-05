# `server/routes/garageAdminStoreWallets.ts`

> Super-admin surface for per-user, per-currency store wallets.

**Kind:** Express router · **Lines:** 341 · **Mounted at:** `/garage-admin` (browser: `/backend/garage-admin`)

<!-- docgen:auto -->

## Purpose
Super-admin surface for per-user, per-currency store wallets.
Mounted at /garage-admin/store-wallets (see app.ts).

Endpoints:
  GET  /garage-admin/store-wallets/user/:userId/org/:orgId
    List every store wallet for (userId, orgId). Auto-mints missing
    cryptobrand-currency wallets on the way in (safety-net for
    members who joined before the cryptobrand flag was flipped).

  POST /garage-admin/store-wallets/:walletId/topup
    Raw credit in the wallet's currency (no FX conversion). Writes
    a WalletTransaction row so the credit shows up in the audit
    ledger. Body: { amount: number, note?: string }.
    Idempotent via optional { idempotencyKey } — a repeat POST with
    the same key returns the prior transaction instead of double-
    crediting.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (4)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| GET | `/cryptobrand-offices` | `/backend/garage-admin/cryptobrand-offices` | `requireGarageAdminAuth` | inline | 32 |
| GET | `/cryptobrand-offices/:orgId/members` | `/backend/garage-admin/cryptobrand-offices/:orgId/members` | `requireGarageAdminAuth` | inline | 86 |
| GET | `/store-wallets/user/:userId/org/:orgId` | `/backend/garage-admin/store-wallets/user/:userId/org/:orgId` | `requireGarageAdminAuth` | inline | 160 |
| POST | `/store-wallets/:walletId/topup` | `/backend/garage-admin/store-wallets/:walletId/topup` | `requireGarageAdminAuth` | inline | 243 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 340 |

## Interfaces

- **Database (Mongoose models used):**
  - `Organization` (server/models/organization.model.ts) — reads: `find`, `findById`
  - `User` (server/models/user.model.ts) — reads: `aggregate`, `find`, `findById`
  - `StoreWallet` (server/models/storeWallet.model.ts) — reads: `find`, `findById`
  - `WalletTransaction` (server/models/walletTransaction.model.ts) — reads: `findOne`; **writes:** `create`

## Dependencies

- **Internal:**
  - `server/middleware/garageAdminAuth.ts` — `requireGarageAdminAuth`
  - `server/models/storeWallet.model.ts` — `StoreWallet`
  - `server/models/walletTransaction.model.ts` — `WalletTransaction`
  - `server/models/user.model.ts` — `User`
  - `server/models/organization.model.ts` — `Organization`
  - `server/services/cryptobrandWallets.ts` — `ensureCryptobrandWallets`
- **Packages:**
  - `express` — `Router`, `Request`, `Response`
  - `mongoose` — `Types`
  - `zod` — `z`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/garage-admin`.
