# `server/routes/userActivity.ts`

> Express router with 6 endpoints, mounted at `/user-activity`.

**Kind:** Express router · **Lines:** 256 · **Mounted at:** `/user-activity` (browser: `/backend/user-activity`)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (6)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| GET | `/` | `/backend/user-activity` | `requireAuth` | inline | 11 |
| GET | `/org` | `/backend/user-activity/org` | `requireAuth` | inline | 74 |
| POST | `/` | `/backend/user-activity` | `requireAuth` | inline | 131 |
| POST | `/read` | `/backend/user-activity/read` | `requireAuth` | inline | 182 |
| GET | `/unread-count` | `/backend/user-activity/unread-count` | `requireAuth` | inline | 211 |
| GET | `/org/unread-count` | `/backend/user-activity/org/unread-count` | `requireAuth` | inline | 234 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 256 |

## Interfaces

- **Socket.IO events:**
  - emits: `activity:new`
- **Database (Mongoose models used):**
  - `UserActivity` (server/models/userActivity.model.ts) — reads: `find`, `findById`, `countDocuments`; **writes:** `create`, `updateMany`

## Dependencies

- **Internal:**
  - `server/middleware/auth.ts` — `requireAuth`
  - `server/models/userActivity.model.ts` — `UserActivity`
  - `server/services/socket.ts` — `getSocketInstance`
- **Packages:**
  - `express` — `Router`
  - `zod` — `z`
  - `mongoose` — `Types`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/user-activity`.
