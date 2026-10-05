# `server/routes/office.ts`

> Express router with 2 endpoints, mounted at `/office`.

**Kind:** Express router · **Lines:** 261 · **Mounted at:** `/office` (browser: `/backend/office`)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (2)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| GET | `/bat246/members` | `/backend/office/bat246/members` | `requireAuth` | inline | 208 |
| GET | `/:orgId/members` | `/backend/office/:orgId/members` | `requireAuth` | inline | 240 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 260 |

## Interfaces

- **Database (Mongoose models used):**
  - `Organization` (server/models/organization.model.ts) — reads: `findById`
  - `User` (server/models/user.model.ts) — reads: `find`
  - `Product` (server/models/product.model.ts) — reads: `findOne`

## Dependencies

- **Internal:**
  - `server/middleware/auth.ts` — `requireAuth`
  - `server/models/user.model.ts` — `User`
  - `server/models/organization.model.ts` — `Organization`
  - `server/models/product.model.ts` — `Product`
- **Packages:**
  - `express` — `Router`, `Response`
  - `mongoose` — `Types`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/office`.
