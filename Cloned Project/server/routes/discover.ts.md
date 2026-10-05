# `server/routes/discover.ts`

> Express router with 4 endpoints, mounted at `/discover`.

**Kind:** Express router · **Lines:** 197 · **Mounted at:** `/discover` (browser: `/backend/discover`)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (4)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| GET | `/categories` | `/backend/discover/categories` | — | inline | 9 |
| GET | `/organizations` | `/backend/discover/organizations` | — | inline | 34 |
| GET | `/featured` | `/backend/discover/featured` | — | inline | 111 |
| GET | `/trending` | `/backend/discover/trending` | — | inline | 154 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 196 |

## Interfaces

- **Database (Mongoose models used):**
  - `Organization` (server/models/organization.model.ts) — reads: `aggregate`, `find`, `countDocuments`
  - `User` (server/models/user.model.ts) — reads: `countDocuments`, `aggregate`

## Dependencies

- **Internal:**
  - `server/models/organization.model.ts` — `Organization`
  - `server/models/user.model.ts` — `User`
- **Packages:**
  - `express` — `Router`
  - `mongoose` — `Types`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/discover`.
