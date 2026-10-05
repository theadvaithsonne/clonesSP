# `server/routes/franchiseEntity.ts`

> Express router with 3 endpoints, mounted at `/franchise-entity`.

**Kind:** Express router · **Lines:** 640 · **Mounted at:** `/franchise-entity` (browser: `/backend/franchise-entity`)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (3)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| GET | `/:level/:entityId/customers` | `/backend/franchise-entity/:level/:entityId/customers` | — | inline | 181 |
| GET | `/:level/:entityId/affiliates` | `/backend/franchise-entity/:level/:entityId/affiliates` | — | inline | 332 |
| GET | `/:level/:entityId/stats` | `/backend/franchise-entity/:level/:entityId/stats` | — | inline | 501 |

**Router-level middleware** (`router.use`, runs before route matching):
- `requireAuth` (L26)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 639 |

## Interfaces

- **Database (Mongoose models used):**
  - `FranchiseCountry` (server/models/franchiseCountry.model.ts) — reads: `findById`
  - `FranchiseTerritory` (server/models/franchiseTerritory.model.ts) — reads: `findById`
  - `FranchiseSubTerritory` (server/models/franchiseSubTerritory.model.ts) — reads: `findById`
  - `Organization` (server/models/organization.model.ts) — reads: `find`
  - `Invoice` (server/models/invoice.model.ts) — reads: `aggregate`
  - `User` (server/models/user.model.ts) — reads: `find`
  - `CommissionDistribution` (server/models/commissionDistribution.model.ts) — reads: `aggregate`

## Dependencies

- **Internal:**
  - `server/middleware/auth.ts` — `requireAuth`
  - `server/models/invoice.model.ts` — `Invoice`
  - `server/models/organization.model.ts` — `Organization`
  - `server/models/user.model.ts` — `User`
  - `server/models/commissionDistribution.model.ts` — `CommissionDistribution`
  - `server/models/franchiseCountry.model.ts` — `FranchiseCountry`
  - `server/models/franchiseTerritory.model.ts` — `FranchiseTerritory`
  - `server/models/franchiseSubTerritory.model.ts` — `FranchiseSubTerritory`
  - `server/utils/entityAccess.ts` — `canAccessEntity`, `EntityLevel`
- **Packages:**
  - `express` — `Router`, `Request`, `Response`
  - `mongoose` — `Types`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/franchise-entity`.
