# `server/routes/todos.ts`

> Express router with 5 endpoints, mounted at `/todos`.

**Kind:** Express router · **Lines:** 157 · **Mounted at:** `/todos` (browser: `/backend/todos`)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (5)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| GET | `/` | `/backend/todos` | `requireAuth` | inline | 12 |
| GET | `/user/:userId` | `/backend/todos/user/:userId` | `requireAuth` | inline | 30 |
| POST | `/` | `/backend/todos` | `requireAuth` | inline | 50 |
| PATCH | `/:id` | `/backend/todos/:id` | `requireAuth` | inline | 104 |
| DELETE | `/:id` | `/backend/todos/:id` | `requireAuth` | inline | 133 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 156 |

## Interfaces

- **Database (Mongoose models used):**
  - `Todo` (server/models/todo.model.ts) — reads: `find`, `findById`; **writes:** `create`, `findOneAndUpdate`, `deleteOne`
  - `User` (server/models/user.model.ts) — reads: `findById`

## Dependencies

- **Internal:**
  - `server/middleware/auth.ts` — `requireAuth`
  - `server/models/todo.model.ts` — `Todo`
  - `server/services/socket.ts` — `emitNotification`
  - `server/models/user.model.ts` — `User`
- **Packages:**
  - `express` — `Router`
  - `zod` — `z`
  - `mongoose` — `Types`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/todos`.
