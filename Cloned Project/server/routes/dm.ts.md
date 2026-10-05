# `server/routes/dm.ts`

> Express router with 9 endpoints, mounted at `/dm`.

**Kind:** Express router · **Lines:** 431 · **Mounted at:** `/dm` (browser: `/backend/dm`)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (9)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| GET | `/:otherId/messages` | `/backend/dm/:otherId/messages` | `requireAuth` | inline | 20 |
| POST | `/:otherId/read` | `/backend/dm/:otherId/read` | `requireAuth` | inline | 59 |
| PUT | `/message/:messageId` | `/backend/dm/message/:messageId` | `requireAuth` | inline | 124 |
| DELETE | `/message/:messageId` | `/backend/dm/message/:messageId` | `requireAuth` | inline | 167 |
| GET | `/unread` | `/backend/dm/unread` | `requireAuth` | inline | 221 |
| GET | `/last-messages` | `/backend/dm/last-messages` | `requireAuth` | inline | 268 |
| POST | `/:otherId/clear` | `/backend/dm/:otherId/clear` | `requireAuth` | inline | 333 |
| GET | `/:otherId/settings` | `/backend/dm/:otherId/settings` | `requireAuth` | inline | 355 |
| PUT | `/:otherId/settings` | `/backend/dm/:otherId/settings` | `requireAuth` | inline | 378 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 430 |

## Interfaces

- **Socket.IO events:**
  - emits: `dm:read`, `dm:seen`, `dm:message-deleted`, `dm:settings`
- **Database (Mongoose models used):**
  - `Message` (server/models/message.model.ts) — reads: `find`, `aggregate`; **writes:** `updateMany`, `findOneAndUpdate`
  - `ChatClear` (server/models/chatClear.model.ts) — **writes:** `findOneAndUpdate`
  - `DmSettings` (server/models/dmSettings.model.ts) — reads: `findOne`; **writes:** `findOneAndUpdate`

## Dependencies

- **Internal:**
  - `server/middleware/auth.ts` — `requireAuth`
  - `server/models/message.model.ts` — `Message`
  - `server/utils/conv.ts` — `dmConvId`
  - `server/services/socket.ts` — `getSocketInstance`
  - `server/models/chatClear.model.ts` — `ChatClear`, `clearedAtFor`, `dmClearedNorClauses`
  - `server/models/dmSettings.model.ts` — `DmSettings`, `RETENTION_DAY_OPTIONS`
- **Packages:**
  - `express` — `Router`
  - `zod` — `z`
  - `mongoose` — `Types`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/dm`.
