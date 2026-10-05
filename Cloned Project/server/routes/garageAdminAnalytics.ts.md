# `server/routes/garageAdminAnalytics.ts`

> Express router with 2 endpoints, mounted at `/garage-admin`.

**Kind:** Express router · **Lines:** 395 · **Mounted at:** `/garage-admin` (browser: `/backend/garage-admin`)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (2)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| GET | `/analytics/traction` | `/backend/garage-admin/analytics/traction` | `requireGarageAdminAuth` | inline | 269 |
| GET | `/analytics/subscriptions` | `/backend/garage-admin/analytics/subscriptions` | `requireGarageAdminAuth` | inline | 348 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 394 |

## Interfaces

- **Raw collections:** `teamforceemployeeprofiles`, `users`

## Dependencies

- **Internal:**
  - `server/middleware/garageAdminAuth.ts` — `requireGarageAdminAuth`
- **Packages:**
  - `express` — `Router`, `Request`, `Response`
  - `mongoose`
  - `zod` — `z`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/garage-admin`.
