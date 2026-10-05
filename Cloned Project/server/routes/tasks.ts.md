# `server/routes/tasks.ts`

> Express router with 4 endpoints, mounted at `/tasks`.

**Kind:** Express router · **Lines:** 95 · **Mounted at:** `/tasks` (browser: `/backend/tasks`)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (4)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| GET | `/` | `/backend/tasks` | `requireAuth` | inline | 10 |
| POST | `/` | `/backend/tasks` | `requireAuth` | inline | 23 |
| PATCH | `/:id` | `/backend/tasks/:id` | `requireAuth` | inline | 48 |
| DELETE | `/:id` | `/backend/tasks/:id` | `requireAuth` | inline | 85 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 95 |

## Interfaces

- **Database (Mongoose models used):**
  - `Task` (server/models/task.model.ts) — reads: `find`; **writes:** `create`, `findOneAndUpdate`, `deleteOne`

## Dependencies

- **Internal:**
  - `server/middleware/auth.ts` — `requireAuth`
  - `server/models/task.model.ts` — `Task`
- **Packages:**
  - `express` — `Router`
  - `zod` — `z`
  - `mongoose` — `Types`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/tasks`.
