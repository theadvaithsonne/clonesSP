# `server/routes/floor.ts`

> Express router with 6 endpoints, mounted at `/floors`.

**Kind:** Express router · **Lines:** 358 · **Mounted at:** `/floors` (browser: `/backend/floors`)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (6)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| GET | `/` | `/backend/floors` | `requireAuth` | inline | 35 |
| POST | `/` | `/backend/floors` | `requireAuth` | inline | 79 |
| POST | `/setup` | `/backend/floors/setup` | `requireAuth` | inline | 132 |
| PATCH | `/:id` | `/backend/floors/:id` | `requireAuth` | inline | 178 |
| DELETE | `/:id` | `/backend/floors/:id` | `requireAuth` | inline | 227 |
| GET | `/roster` | `/backend/floors/roster` | `requireAuth` | inline | 236 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 357 |

## Interfaces

- **Database (Mongoose models used):**
  - `User` (server/models/user.model.ts) — reads: `findById`, `find`
  - `Floor` (server/models/floor.model.ts) — reads: `find`, `findOne`; **writes:** `new + save`, `deleteMany`, `insertMany`, `updateOne`, `deleteOne`
  - `Invite` (server/models/invite.model.ts) — reads: `find`

## Dependencies

- **Internal:**
  - `server/middleware/auth.ts` — `requireAuth`
  - `server/models/floor.model.ts` — `Floor`
  - `server/models/user.model.ts` — `User`
  - `server/models/invite.model.ts` — `Invite`
- **Packages:**
  - `express` — `Router`
  - `zod` — `z`
  - `mongoose` — `Types`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/floors`.
