# `server/routes/franchiseApi.ts`

> Express router with 18 endpoints, mounted at `/franchise-api`.

**Kind:** Express router · **Lines:** 4176 · **Mounted at:** `/franchise-api` (browser: `/backend/franchise-api`)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (18)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| GET | `/wallets/by-email/:email` | `/backend/franchise-api/wallets/by-email/:email` | — | inline | 79 |
| GET | `/wallets/by-user/:userId` | `/backend/franchise-api/wallets/by-user/:userId` | — | inline | 105 |
| GET | `/wallets/by-email/:email/transactions` | `/backend/franchise-api/wallets/by-email/:email/transactions` | — | inline | 131 |
| GET | `/entities/:entityType/:entityId/summary` | `/backend/franchise-api/entities/:entityType/:entityId/summary` | — | inline | 230 |
| GET | `/entities/:entityType/:entityId/offices` | `/backend/franchise-api/entities/:entityType/:entityId/offices` | — | inline | 467 |
| GET | `/owners/by-email/:email/entities` | `/backend/franchise-api/owners/by-email/:email/entities` | — | inline | 585 |
| GET | `/businesses` | `/backend/franchise-api/businesses` | — | inline | 650 |
| GET | `/scope/countries` | `/backend/franchise-api/scope/countries` | — | inline | 1149 |
| GET | `/scope/territories` | `/backend/franchise-api/scope/territories` | — | inline | 1201 |
| GET | `/scope/sub-territories` | `/backend/franchise-api/scope/sub-territories` | — | inline | 1244 |
| GET | `/owners/by-email/:email/offices` | `/backend/franchise-api/owners/by-email/:email/offices` | — | inline | 1295 |
| GET | `/dashboard/countries` | `/backend/franchise-api/dashboard/countries` | — | inline | 1554 |
| GET | `/dashboard/summary` | `/backend/franchise-api/dashboard/summary` | — | inline | 1626 |
| GET | `/dashboard/garagepay-stats` | `/backend/franchise-api/dashboard/garagepay-stats` | — | inline | 1898 |
| GET | `/dashboard/franchise-wallet/transactions` | `/backend/franchise-api/dashboard/franchise-wallet/transactions` | — | inline | 2550 |
| GET | `/franchisees/earnings-table` | `/backend/franchise-api/franchisees/earnings-table` | — | inline | 3291 |
| GET | `/customers/purchase-history` | `/backend/franchise-api/customers/purchase-history` | — | inline | 3584 |
| GET | `/sub-territories/:subTerritoryId/affiliates` | `/backend/franchise-api/sub-territories/:subTerritoryId/affiliates` | — | inline | 3879 |

**Router-level middleware** (`router.use`, runs before route matching):
- `requireFranchiseApiKey` (L26)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 4175 |

## Interfaces

- **Database (Mongoose models used):**
  - `User` (server/models/user.model.ts) — reads: `findOne`, `findById`, `find`, `aggregate`, `countDocuments`
  - `TerritoryWallet` (server/models/territoryWallet.model.ts) — reads: `findOne`
  - `TerritoryWalletTransaction` (server/models/territoryWalletTransaction.model.ts) — reads: `find`, `aggregate`, `distinct`
  - `FranchiseCountry` (server/models/franchiseCountry.model.ts) — reads: `findById`, `find`, `findOne`
  - `FranchiseTerritory` (server/models/franchiseTerritory.model.ts) — reads: `findById`, `find`, `aggregate`, `countDocuments`
  - `FranchiseSubTerritory` (server/models/franchiseSubTerritory.model.ts) — reads: `findById`, `find`, `countDocuments`
  - `Organization` (server/models/organization.model.ts) — reads: `find`, `countDocuments`, `aggregate`
  - `FranchiseGlobalAssignment` (server/models/franchiseGlobalAssignment.model.ts) — reads: `findOne`, `find`
  - `FranchiseTerritoryAssignment` (server/models/franchiseTerritoryAssignment.model.ts) — reads: `find`
  - `CommissionDistribution` (server/models/commissionDistribution.model.ts) — reads: `find`
  - `Invoice` (server/models/invoice.model.ts) — reads: `aggregate`, `find`
  - `UnilevelPlusPurchase` (server/models/unilevelPlusPurchase.model.ts) — reads: `aggregate`
  - `WalletTransaction` (server/models/walletTransaction.model.ts) — reads: `aggregate`

## Dependencies

- **Internal:**
  - `server/models/user.model.ts` — `User`
  - `server/models/organization.model.ts` — `Organization`
  - `server/models/territoryWallet.model.ts` — `TerritoryWallet`
  - `server/models/territoryWalletTransaction.model.ts` — `TerritoryWalletTransaction`
  - `server/models/walletTransaction.model.ts` — `WalletTransaction`
  - `server/models/franchiseCountry.model.ts` — `FranchiseCountry`
  - `server/models/franchiseTerritory.model.ts` — `FranchiseTerritory`
  - `server/models/franchiseSubTerritory.model.ts` — `FranchiseSubTerritory`
  - `server/models/invoice.model.ts` — `Invoice`
  - `server/models/commissionDistribution.model.ts` — `CommissionDistribution`
  - `server/models/franchiseGlobalAssignment.model.ts` — `FranchiseGlobalAssignment`
  - `server/models/franchiseTerritoryAssignment.model.ts` — `FranchiseTerritoryAssignment`
  - `server/models/unilevelPlusPurchase.model.ts` — `UnilevelPlusPurchase`
  - `server/middleware/franchiseApiAuth.ts` — `requireFranchiseApiKey`
- **Packages:**
  - `express` — `Router`, `Request`, `Response`
  - `mongoose` — `Types`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/franchise-api`.

## Notes

- Large file (4176 lines) — read it by section; line numbers above point into it.
