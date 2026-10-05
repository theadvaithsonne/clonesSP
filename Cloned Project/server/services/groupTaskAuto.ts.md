# `server/services/groupTaskAuto.ts`

> Auto-capture Taskroom tasks from a linked group chat.

**Kind:** backend service · **Lines:** 1573

<!-- docgen:auto -->

## Purpose
Auto-capture Taskroom tasks from a linked group chat.

Called fire-and-forget from the socket `group:message` handler for every
top-level message. Cheap gates first — nearly every message is in a group
with no Taskroom link, and most of the rest are chatter — then the AI
(services/groupTaskClassifier.ts) reads the message, its recent context and
any screenshots, and each work item it finds becomes a plain task on the
linked board, with the message's files attached and a system pill in the
chat pointing at it.

Ordering matters here in a way it does not for most background work: a
screenshot posted as its own message right before or after the text that
explains it must end up on the same task. So messages of one group are
processed strictly in order, through an in-process queue per group, and each
capture sees what the previous one filed.
 […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `maybeCaptureGroupTask` | function | `async maybeCaptureGroupTask(groupId: string, messageId: string): Promise<void>` — Entry point from the socket handler. | 183 |
| `isTrustedFileUrl` | function | `isTrustedFileUrl(raw: unknown): boolean` | 244 |
| `BoardGoneError` | class | `extends Error` — The linked board (or the whole room) no longer exists — relink needed. | 295 |
| `createTaskOnBoard` | function | `async createTaskOnBoard(token: string, group: any, body: Record<string, unknown>): Promise<any>` — POST the task. When the stored column (or board) is gone, look the board's columns up again, remember the new one on the link, and retry once. | 330 |
| `attachFiles` | function | `async attachFiles(group: any, roomId: string, taskId: string, files: TaskroomFile[], preferUserId: string): Promise<number>` — Attach files to a task; returns how many landed. | 408 |
| `AssignOutcome` | type |  | 923 |
| `assignTask` | function | `async assignTask(group: any, taskId: string, taskroomUserId: string, preferUserId: string): Promise<AssignOutcome>` — Add one assignee to an existing task. | 933 |
| `maybeUpdateGroupTaskForEdit` | function | `async maybeUpdateGroupTaskForEdit(groupId: string, messageId: string, editorId: string): Promise<void>` — Entry point from the message-edit route. | 1234 |

## Interfaces

- **Socket.IO events:**
  - emits: `group:message-task`
- **Database (Mongoose models used):**
  - `Group` (server/models/group.model.ts) — reads: `findById`; **writes:** `updateOne`
  - `GroupMessage` (server/models/groupMessage.model.ts) — reads: `find`, `findById`, `findOne`; **writes:** `findOneAndUpdate`, `updateMany`
  - `GroupAiTask` (server/models/groupAiTask.model.ts) — reads: `exists`, `find`, `findOne`; **writes:** `updateOne`, `create`
  - `User` (server/models/user.model.ts) — reads: `find`
- **Environment variables (`process.env`):** `GROUP_TASK_AI_DISABLED`, `GROUP_TASK_AI_CONCURRENCY`, `GROUP_TASK_FILE_HOSTS`
- **Environment via `server/config/env.ts`:** `env.AWS_S3_BUCKET`, `env.AWS_S3_REGION`, `env.AWS_S3_ENDPOINT`

## Dependencies

- **Internal:**
  - `server/models/group.model.ts` — `Group`
  - `server/models/groupMessage.model.ts` — `GroupMessage`
  - `server/models/groupAiTask.model.ts` — `GroupAiTask`
  - `server/models/user.model.ts` — `User`
  - `server/services/taskroomProvision.ts` — `taskroomRequest`
  - `server/services/groupTaskroomActor.ts` — `NoTaskroomActorError`, `withTaskroomActor`
  - `server/services/groupTaskroom.ts` — `pickLandingStageId`
  - `server/services/groupSystemMessage.ts` — `writeGroupSystemMessage`
  - `server/services/groupTaskRemoval.ts` — `removeAiTasksForDeletedMessage`
  - `server/services/socket.ts` — `getSocketInstance`
  - `server/config/env.ts` — `env`
  - `server/services/groupTaskClassifier.ts` — `MAX_CLASSIFIER_IMAGES`, `MAX_REPLIED_IMAGES`, `captureDecision`, `classifyGroupMessage`, `editDecision`, `groupTaskMinConfidence`, `matchMentionedName`, `reviseTasksForEdit`, … +10
- **Packages:**
  - `mongoose` — `Types`

## Used by

- `server/realtime/socket.ts`
- `server/routes/groups.ts`
- `server/services/groupTaskManual.ts`

## Notes

- Large file (1573 lines) — read it by section; line numbers above point into it.
