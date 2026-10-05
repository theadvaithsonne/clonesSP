# `server/routes/garageAdminSupportChats.ts`

> Express router with 23 endpoints, mounted at `/garage-admin`.

**Kind:** Express router · **Lines:** 1269 · **Mounted at:** `/garage-admin` (browser: `/backend/garage-admin`)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (23)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| GET | `/support-chats` | `/backend/garage-admin/support-chats` | `requireGarageAdminAuth` | inline | 99 |
| POST | `/support-chats/ensure/:userId` | `/backend/garage-admin/support-chats/ensure/:userId` | `requireGarageAdminAuth` | inline | 245 |
| GET | `/support-chats/:groupId` | `/backend/garage-admin/support-chats/:groupId` | `requireGarageAdminAuth` | inline | 262 |
| GET | `/support-chats/:groupId/messages` | `/backend/garage-admin/support-chats/:groupId/messages` | `requireGarageAdminAuth` | inline | 331 |
| POST | `/support-chats/:groupId/messages` | `/backend/garage-admin/support-chats/:groupId/messages` | `requireGarageAdminAuth` | inline | 425 |
| POST | `/support-chats/:groupId/ticket` | `/backend/garage-admin/support-chats/:groupId/ticket` | `requireGarageAdminAuth` | inline | 509 |
| GET | `/support-chats/:groupId/ticket-suggestion` | `/backend/garage-admin/support-chats/:groupId/ticket-suggestion` | `requireGarageAdminAuth` | inline | 605 |
| POST | `/support-chats/:groupId/messages/:messageId/react` | `/backend/garage-admin/support-chats/:groupId/messages/:messageId/react` | `requireGarageAdminAuth` | inline | 632 |
| PATCH | `/support-chats/:groupId/messages/:messageId` | `/backend/garage-admin/support-chats/:groupId/messages/:messageId` | `requireGarageAdminAuth` | inline | 711 |
| POST | `/support-chats/:groupId/members` | `/backend/garage-admin/support-chats/:groupId/members` | `requireGarageAdminAuth` | inline | 782 |
| GET | `/support-chats/:groupId/typing` | `/backend/garage-admin/support-chats/:groupId/typing` | `requireGarageAdminAuth` | inline | 847 |
| POST | `/support-chats/upload` | `/backend/garage-admin/support-chats/upload` | `requireGarageAdminAuth`, `upload.single("file")` | inline | 891 |
| POST | `/support-chats/:groupId/read` | `/backend/garage-admin/support-chats/:groupId/read` | `requireGarageAdminAuth` | inline | 936 |
| POST | `/support-chats/:groupId/translate` | `/backend/garage-admin/support-chats/:groupId/translate` | `requireGarageAdminAuth` | inline | 969 |
| GET | `/support-chats/:groupId/taskroom` | `/backend/garage-admin/support-chats/:groupId/taskroom` | `requireGarageAdminAuth` | inline | 1014 |
| PUT | `/support-chats/:groupId/taskroom` | `/backend/garage-admin/support-chats/:groupId/taskroom` | `requireGarageAdminAuth` | inline | 1028 |
| DELETE | `/support-chats/:groupId/taskroom` | `/backend/garage-admin/support-chats/:groupId/taskroom` | `requireGarageAdminAuth` | inline | 1049 |
| GET | `/support-chats/:groupId/taskroom/tasks` | `/backend/garage-admin/support-chats/:groupId/taskroom/tasks` | `requireGarageAdminAuth` | inline | 1063 |
| POST | `/support-chats/:groupId/taskroom/tasks` | `/backend/garage-admin/support-chats/:groupId/taskroom/tasks` | `requireGarageAdminAuth` | inline | 1084 |
| DELETE | `/support-chats/:groupId/taskroom/tasks/:taskId` | `/backend/garage-admin/support-chats/:groupId/taskroom/tasks/:taskId` | `requireGarageAdminAuth` | inline | 1144 |
| DELETE | `/support-chats/:groupId/messages/:messageId` | `/backend/garage-admin/support-chats/:groupId/messages/:messageId` | `requireGarageAdminAuth` | inline | 1173 |
| GET | `/support-chats/:groupId/taskroom/tasks/:taskId/link` | `/backend/garage-admin/support-chats/:groupId/taskroom/tasks/:taskId/link` | `requireGarageAdminAuth` | inline | 1221 |
| POST | `/support-chats/:groupId/taskroom/tasks/:taskId/assign` | `/backend/garage-admin/support-chats/:groupId/taskroom/tasks/:taskId/assign` | `requireGarageAdminAuth` | inline | 1243 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 1268 |

## Interfaces

- **Socket.IO events:**
  - emits: `group:message-reactions`, `group:message-edited`, `group:read`, `group:message-deleted`
- **Database (Mongoose models used):**
  - `User` (server/models/user.model.ts) — reads: `findOne`, `find`, `findById`
  - `Group` (server/models/group.model.ts) — reads: `findOne`, `countDocuments`, `find`; **writes:** `updateOne`
  - `GarageAdminModel` (server/models/garageAdmin.model.ts) — reads: `find`, `findById`
  - `GroupMessage` (server/models/groupMessage.model.ts) — reads: `find`, `findOne`; **writes:** `findOneAndUpdate`
  - `Ticket` (server/models/ticket.model.ts) — **writes:** `create`

## Dependencies

- **Internal:**
  - `server/middleware/garageAdminAuth.ts` — `requireGarageAdminAuth`, `GarageAdminRequest`
  - `server/models/group.model.ts` — `Group`
  - `server/models/groupMessage.model.ts` — `GroupMessage`
  - `server/models/user.model.ts` — `User`
  - `server/models/garageAdmin.model.ts` — `GarageAdminModel`
  - `server/models/ticket.model.ts` — `Ticket`
  - `server/services/supportTicketSuggest.ts` — `suggestTicketForChat`
  - `server/services/s3.ts` — `s3Service`
  - `server/services/supportChat.ts` — `ensureSupportGroup`, `postGroupMessageAs`
  - `server/services/messageTranslation.ts` — `isTranslateLang`, `MAX_TRANSLATE_BATCH`, `translateGroupMessages`
- **Packages:**
  - `express` — `Router`, `Response`
  - `mongoose` — `Types`
  - `zod` — `z`
  - `multer`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/garage-admin`.
