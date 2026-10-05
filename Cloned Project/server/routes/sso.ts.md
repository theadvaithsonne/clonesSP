# `server/routes/sso.ts`

> Express router with 3 endpoints, mounted at `/sso`.

**Kind:** Express router · **Lines:** 159 · **Mounted at:** `/sso` (browser: `/backend/sso`)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (3)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| POST | `/exchange-token` | `/backend/sso/exchange-token` | `requireAuth` | inline | 24 |
| POST | `/validate-token` | `/backend/sso/validate-token` | — | inline | 61 |
| POST | `/validate-jwt` | `/backend/sso/validate-jwt` | — | inline | 115 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 158 |

## Interfaces

- **Database (Mongoose models used):**
  - `User` (server/models/user.model.ts) — reads: `findById`
- **Timers / queues:** `setInterval` at L13

## Dependencies

- **Internal:**
  - `server/middleware/auth.ts` — `requireAuth`, `AuthRequest`
  - `server/services/jwt.ts` — `signJwt`, `verifyJwt`
  - `server/models/user.model.ts` — `User`
- **Packages:**
  - `express` — `Router`, `Request`, `Response`
  - `crypto`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/sso`.
