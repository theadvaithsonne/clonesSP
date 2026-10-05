# `server/routes/orgCustomers.ts`

> Express router with 2 endpoints, mounted at `/orgs`.

**Kind:** Express router · **Lines:** 323 · **Mounted at:** `/orgs` (browser: `/backend/orgs`)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (2)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| GET | `/active` | `/backend/orgs/active` | — | `handleActiveOrgs` | 20 |
| GET | `/:officeId/customers` | `/backend/orgs/:officeId/customers` | — | inline | 53 |

**Router-level middleware** (`router.use`, runs before route matching):
- `requireAuth` (L22)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 322 |

## Interfaces

- **Database (Mongoose models used):**
  - `Invoice` (server/models/invoice.model.ts) — reads: `aggregate`
  - `User` (server/models/user.model.ts) — reads: `find`
  - `FranchiseProgram` (server/models/franchiseProgram.model.ts) — reads: `find`
  - `Organization` (server/models/organization.model.ts) — reads: `find`

## Dependencies

- **Internal:**
  - `server/middleware/auth.ts` — `requireAuth`
  - `server/models/invoice.model.ts` — `Invoice`
  - `server/models/user.model.ts` — `User`
  - `server/models/organization.model.ts` — `Organization`
  - `server/models/franchiseProgram.model.ts` — `FranchiseProgram`
  - `server/utils/officeCustomerAccess.ts` — `canAccessOfficeCustomers`
- **Packages:**
  - `express` — `Router`, `Request`, `Response`
  - `mongoose` — `Types`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/orgs`.
