# `server/routes/garageAdminWallets.ts`

> Express router with 10 endpoints, mounted at `/garage-admin/wallets`.

**Kind:** Express router · **Lines:** 530 · **Mounted at:** `/garage-admin/wallets` (browser: `/backend/garage-admin/wallets`)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (10)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| GET | `/` | `/backend/garage-admin/wallets` | — | inline | 27 |
| GET | `/stats` | `/backend/garage-admin/wallets/stats` | — | inline | 152 |
| GET | `/ledger` | `/backend/garage-admin/wallets/ledger` | — | inline | 200 |
| GET | `/ledger/export.csv` | `/backend/garage-admin/wallets/ledger/export.csv` | — | inline | 252 |
| GET | `/:orgId` | `/backend/garage-admin/wallets/:orgId` | — | inline | 308 |
| GET | `/:orgId/transactions` | `/backend/garage-admin/wallets/:orgId/transactions` | — | inline | 345 |
| POST | `/:orgId/credit` | `/backend/garage-admin/wallets/:orgId/credit` | — | inline | 373 |
| POST | `/:orgId/debit` | `/backend/garage-admin/wallets/:orgId/debit` | — | inline | 405 |
| POST | `/:orgId/clear-debt` | `/backend/garage-admin/wallets/:orgId/clear-debt` | — | inline | 447 |
| POST | `/bulk-credit` | `/backend/garage-admin/wallets/bulk-credit` | — | inline | 469 |

**Router-level middleware** (`router.use`, runs before route matching):
- `requireGarageAdminAuth, requireGarageSuperAdmin` (L24)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `MAX_ADMIN_ACTION_CENTS` | const | `= 100_000` | 22 |
| `default (router)` | default |  | 529 |

## Interfaces

- **Database (Mongoose models used):**
  - `Organization` (server/models/organization.model.ts) — reads: `find`, `findById`
  - `User` (server/models/user.model.ts) — reads: `find`, `findOne`
  - `AivatarWallet` (server/models/aivatarWallet.model.ts) — reads: `find`, `countDocuments`, `aggregate`, `findOne`
  - `AivatarWalletTransaction` (server/models/aivatarWalletTransaction.model.ts) — reads: `find`, `countDocuments`, `aggregate`

## Dependencies

- **Internal:**
  - `server/middleware/garageAdminAuth.ts` — `requireGarageAdminAuth`, `requireGarageSuperAdmin`, `GarageAdminRequest`
  - `server/models/organization.model.ts` — `Organization`
  - `server/models/user.model.ts` — `User`
  - `server/models/aivatarWallet.model.ts` — `AivatarWallet`
  - `server/models/aivatarWalletTransaction.model.ts` — `AivatarWalletTransaction`
  - `server/services/aivatarWallet.service.ts` — `addAivatarCredits`, `deductAivatarCreditsWithDebt`, `clearAivatarDebt`, `getOrCreateAivatarWallet`
- **Packages:**
  - `express` — `Router`, `Response`
  - `mongoose` — `Types`
  - `json2csv` — `Parser as Json2csvParser`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/garage-admin/wallets`.
