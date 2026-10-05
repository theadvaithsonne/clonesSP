# `server/routes/slashDeals.ts`

> Express router with 4 endpoints, mounted at `/slash/deals`.

**Kind:** Express router · **Lines:** 118 · **Mounted at:** `/slash/deals` (browser: `/backend/slash/deals`)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (4)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| POST | `/` | `/backend/slash/deals` | `requireAuth` | inline | 19 |
| GET | `/search` | `/backend/slash/deals/search` | `requireAuth` | inline | 48 |
| GET | `/:id` | `/backend/slash/deals/:id` | `requireAuth` | inline | 73 |
| PATCH | `/:id/stage` | `/backend/slash/deals/:id/stage` | `requireAuth` | inline | 89 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 117 |

## Interfaces

- **Socket.IO events:**
  - emits: `slash:deal-updated`
- **Database (Mongoose models used):**
  - `Deal` (server/models/deal.model.ts) — reads: `find`, `findOne`; **writes:** `create`, `findOneAndUpdate`

## Dependencies

- **Internal:**
  - `server/middleware/auth.ts` — `requireAuth`
  - `server/models/deal.model.ts` — `Deal`
  - `server/services/socket.ts` — `getSocketInstance`
- **Packages:**
  - `express` — `Router`
  - `zod` — `z`
  - `mongoose` — `Types`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/slash/deals`.
