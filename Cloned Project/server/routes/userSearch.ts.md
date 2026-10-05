# `server/routes/userSearch.ts`

> Express router with 2 endpoints, mounted at `/garage-admin/users`.

**Kind:** Express router · **Lines:** 100 · **Mounted at:** `/garage-admin/users`, `/org/:orgId/users` (browser: `/backend/garage-admin/users`, `/backend/org/:orgId/users`)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (2)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| GET | `/search` | `/backend/garage-admin/users/search` | `requireGarageAdminAuth` | inline | 14 |
| GET | `/search` | `/backend/garage-admin/users/search` | `requireAuth`, `requireFounder` | inline | 72 |

The router is also mounted at `/org/:orgId/users`; every path above exists under each mount.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `adminUserSearchRouter` | const | `= Router()` — Returns up to `limit` verified users matching `q` against name OR email. | 12 |
| `founderUserSearchRouter` | const | `= Router({ mergeParams: true })` — Founder-scoped: search verified users who are members of :orgId. | 44 |

## Interfaces

- **Database (Mongoose models used):**
  - `User` (server/models/user.model.ts) — reads: `find`, `findById`

## Dependencies

- **Internal:**
  - `server/middleware/auth.ts` — `requireAuth`, `AuthRequest`
  - `server/middleware/garageAdminAuth.ts` — `requireGarageAdminAuth`, `GarageAdminRequest`
  - `server/utils/accessCheck.ts` — `hasFounderAccess`
  - `server/models/user.model.ts` — `User`
- **Packages:**
  - `express` — `Router`, `Request`, `Response`, `NextFunction`
  - `mongoose` — `Types`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/garage-admin/users`, `/org/:orgId/users`.
