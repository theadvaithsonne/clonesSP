# `server/routes/groups.ts`

> Express router with 34 endpoints, mounted at `/groups`.

**Kind:** Express router · **Lines:** 1999 · **Mounted at:** `/groups` (browser: `/backend/groups`)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (34)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| GET | `/` | `/backend/groups` | `requireAuth` | inline | 137 |
| POST | `/` | `/backend/groups` | `requireAuth` | inline | 246 |
| GET | `/unread/all` | `/backend/groups/unread/all` | `requireAuth` | inline | 309 |
| GET | `/last-messages` | `/backend/groups/last-messages` | `requireAuth` | inline | 416 |
| GET | `/support` | `/backend/groups/support` | `requireAuth` | inline | 529 |
| GET | `/support/unread` | `/backend/groups/support/unread` | `requireAuth` | inline | 660 |
| POST | `/:groupId/translate` | `/backend/groups/:groupId/translate` | `requireAuth` | inline | 710 |
| GET | `/:groupId` | `/backend/groups/:groupId` | `requireAuth` | inline | 751 |
| PUT | `/:groupId` | `/backend/groups/:groupId` | `requireAuth` | inline | 805 |
| POST | `/:groupId/members` | `/backend/groups/:groupId/members` | `requireAuth` | inline | 888 |
| DELETE | `/:groupId/members/:memberId` | `/backend/groups/:groupId/members/:memberId` | `requireAuth` | inline | 939 |
| GET | `/:groupId/messages` | `/backend/groups/:groupId/messages` | `requireAuth` | inline | 1022 |
| POST | `/:groupId/clear` | `/backend/groups/:groupId/clear` | `requireAuth` | inline | 1070 |
| GET | `/:groupId/thread/:messageId` | `/backend/groups/:groupId/thread/:messageId` | `requireAuth` | inline | 1094 |
| PATCH | `/:groupId/thread/:messageId/resolve` | `/backend/groups/:groupId/thread/:messageId/resolve` | `requireAuth` | inline | 1127 |
| POST | `/:groupId/read` | `/backend/groups/:groupId/read` | `requireAuth` | inline | 1172 |
| PUT | `/:groupId/message/:messageId` | `/backend/groups/:groupId/message/:messageId` | `requireAuth` | inline | 1216 |
| DELETE | `/:groupId/message/:messageId` | `/backend/groups/:groupId/message/:messageId` | `requireAuth` | inline | 1270 |
| DELETE | `/:groupId/message/:messageId/taskroom` | `/backend/groups/:groupId/message/:messageId/taskroom` | `requireAuth` | inline | 1338 |
| POST | `/:groupId/agent-reply` | `/backend/groups/:groupId/agent-reply` | `requireAuth` | inline | 1397 |
| PUT | `/:groupId/settings` | `/backend/groups/:groupId/settings` | `requireAuth` | inline | 1441 |
| USE | `/:groupId/taskroom` | `/backend/groups/:groupId/taskroom` | — | inline | 1548 |
| PUT | `/:groupId/taskroom` | `/backend/groups/:groupId/taskroom` | `requireAuth` | inline | 1568 |
| PATCH | `/:groupId/taskroom` | `/backend/groups/:groupId/taskroom` | `requireAuth` | inline | 1603 |
| POST | `/:groupId/taskroom/sync` | `/backend/groups/:groupId/taskroom/sync` | `requireAuth` | inline | 1629 |
| DELETE | `/:groupId/taskroom` | `/backend/groups/:groupId/taskroom` | `requireAuth` | inline | 1656 |
| POST | `/:groupId/taskroom/task` | `/backend/groups/:groupId/taskroom/task` | `requireAuth` | inline | 1701 |
| GET | `/:groupId/taskroom/tasks` | `/backend/groups/:groupId/taskroom/tasks` | `requireAuth` | inline | 1732 |
| DELETE | `/:groupId/taskroom/tasks/:taskId` | `/backend/groups/:groupId/taskroom/tasks/:taskId` | `requireAuth` | inline | 1760 |
| PUT | `/:groupId/taskroom/tasks/:taskId/assign` | `/backend/groups/:groupId/taskroom/tasks/:taskId/assign` | `requireAuth` | inline | 1797 |
| PUT | `/:groupId/members/:memberId/role` | `/backend/groups/:groupId/members/:memberId/role` | `requireAuth` | inline | 1834 |
| POST | `/:groupId/invite-link` | `/backend/groups/:groupId/invite-link` | `requireAuth` | inline | 1882 |
| DELETE | `/:groupId/invite-link` | `/backend/groups/:groupId/invite-link` | `requireAuth` | inline | 1929 |
| GET | `/invite/:code` | `/backend/groups/invite/:code` | — | inline | 1952 |
| POST | `/invite/:code/join` | `/backend/groups/invite/:code/join` | `requireAuth` | inline | 1972 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 1998 |

## Interfaces

- **Socket.IO events:**
  - emits: `group:thread-update`, `group:read`, `group:message-deleted`, `group:message`
- **Database (Mongoose models used):**
  - `Group` (server/models/group.model.ts) — reads: `aggregate`, `findOne`, `findById`; **writes:** `create`, `updateOne`
  - `User` (server/models/user.model.ts) — reads: `find`
  - `GroupMessage` (server/models/groupMessage.model.ts) — reads: `find`, `findOne`; **writes:** `findOneAndUpdate`, `create`
  - `ChatClear` (server/models/chatClear.model.ts) — **writes:** `findOneAndUpdate`
- **Environment variables (`process.env`):** `APP_URL`, `NEXT_PUBLIC_APP_URL`

## Dependencies

- **Internal:**
  - `server/middleware/auth.ts` — `requireAuth`
  - `server/models/group.model.ts` — `Group`
  - `server/models/groupMessage.model.ts` — `GroupMessage`
  - `server/models/user.model.ts` — `User`
  - `server/services/socket.ts` — `getSocketInstance`
  - `server/services/groupSystemMessage.ts` — `writeGroupSystemMessage`
  - `server/models/chatClear.model.ts` — `ChatClear`, `clearedAtFor`
  - `server/services/supportChat.ts` — `isSupportGroup`, `isSupportStaff`
  - `server/services/messageTranslation.ts` — `isTranslateLang`, `MAX_TRANSLATE_BATCH`, `translateGroupMessages`
  - `server/services/groupTaskroom.ts` — `GroupTaskroomError`, `linkGroupTaskroom`, `requestGroupTaskroomSync`, `serializeGroupTaskroom`, `setGroupTaskroomEnabled`, `unlinkGroupTaskroom`
  - `server/services/groupTaskRemoval.ts` — `removeAiTasksForDeletedMessage`, `removeAiTasksFromMessage`
  - `server/services/groupTaskManual.ts` — `assignGroupTask`, `createManualTask`, `listGroupTasks`, `removeGroupTaskById`
- **Packages:**
  - `express` — `Router`
  - `zod` — `z`
  - `crypto`
  - `mongoose` — `Types`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/groups`.

## Notes

- Large file (1999 lines) — read it by section; line numbers above point into it.
