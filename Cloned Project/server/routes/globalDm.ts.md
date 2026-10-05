# `server/routes/globalDm.ts`

> Express router with 7 endpoints, mounted at `/global-dm`.

**Kind:** Express router · **Lines:** 313 · **Mounted at:** `/global-dm` (browser: `/backend/global-dm`)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (7)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| GET | `/:otherId/messages` | `/backend/global-dm/:otherId/messages` | `requireAuth` | inline | 13 |
| POST | `/:otherId/read` | `/backend/global-dm/:otherId/read` | `requireAuth` | inline | 38 |
| PUT | `/message/:messageId` | `/backend/global-dm/message/:messageId` | `requireAuth` | inline | 69 |
| DELETE | `/message/:messageId` | `/backend/global-dm/message/:messageId` | `requireAuth` | inline | 115 |
| GET | `/unread` | `/backend/global-dm/unread` | `requireAuth` | inline | 145 |
| GET | `/last-messages` | `/backend/global-dm/last-messages` | `requireAuth` | inline | 178 |
| GET | `/conversations` | `/backend/global-dm/conversations` | `requireAuth` | inline | 219 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 312 |

## Interfaces

- **Socket.IO events:**
  - emits: `global-dm:read`, `global-dm:edited`, `global-dm:deleted`
- **Database (Mongoose models used):**
  - `GlobalMessage` (server/models/globalMessage.model.ts) — reads: `find`, `aggregate`; **writes:** `updateMany`, `findOneAndUpdate`, `findOneAndDelete`
  - `User` (server/models/user.model.ts) — reads: `find`

## Dependencies

- **Internal:**
  - `server/middleware/auth.ts` — `requireAuth`
  - `server/models/globalMessage.model.ts` — `GlobalMessage`
  - `server/utils/globalConv.ts` — `globalDmConvId`
  - `server/services/socket.ts` — `getSocketInstance`
  - `server/models/user.model.ts` — `User`
- **Packages:**
  - `express` — `Router`
  - `zod` — `z`
  - `mongoose` — `Types`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/global-dm`.
