# `server/routes/usersLastSeen.ts`

> Express router with 1 endpoint, mounted at `/users`.

**Kind:** Express router · **Lines:** 55 · **Mounted at:** `/users` (browser: `/backend/users`)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (1)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| GET | `/last-seen` | `/backend/users/last-seen` | `requireAuth` | inline | 18 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 54 |

## Interfaces

- **Database (Mongoose models used):**
  - `User` (server/models/user.model.ts) — reads: `find`

## Dependencies

- **Internal:**
  - `server/middleware/auth.ts` — `requireAuth`
  - `server/models/user.model.ts` — `User`
- **Packages:**
  - `express` — `Router`
  - `mongoose` — `Types`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/users`.
