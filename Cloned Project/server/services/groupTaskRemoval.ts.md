# `server/services/groupTaskRemoval.ts`

> src/services/groupTaskRemoval.ts

**Kind:** backend service · **Lines:** 239

<!-- docgen:auto -->

## Purpose
src/services/groupTaskRemoval.ts

Taking AI-filed Taskroom tasks back out (services/groupTaskAuto.ts files them).

Two entry points:

  • removeAiTasksForDeletedMessage — "delete the message, delete the task".
    Called only by the explicit user delete
    (DELETE /groups/:groupId/message/:messageId). Retention sweeps and
    account cleanup also blank messages, but nobody asked for the work to be
    cancelled there, so their tasks are left alone. Only the message that
    TRIGGERED a task takes it down: deleting a reply that merely assigned the
    task, or a screenshot that was attached to it, leaves the task standing.

  • removeAiTasksFromMessage — the "Remove from Taskroom" menu action
    (DELETE /groups/:groupId/message/:messageId/taskroom). The message stays; […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `removeGroupTasks` | function | `async removeGroupTasks(groupId: string, group: any, tasks: any[], actorId: string): Promise<{ removed: number; failed: number }>` — Remove specific tasks by their GroupAiTask rows, from the same code path the message-level removals use — Taskroom soft-delete, mark pull from every message that carries them, and an `ai_task_removed` pill each. | 144 |
| `removeAiTasksForDeletedMessage` | function | `async removeAiTasksForDeletedMessage(groupId: string, messageId: string, actorId: string): Promise<void>` — The deleted message's own tasks go with it. | 165 |
| `removeAiTasksFromMessage` | function | `async removeAiTasksFromMessage(groupId: string, message: any, actorId: string, opts: { isAdmin: boolean }): Promise<{ found: number; removed: number; failed:…` — "Remove from Taskroom": remove every task the message is marked with (or triggered) and keep the message. | 199 |

## Interfaces

- **Socket.IO events:**
  - emits: `group:message-task`
- **Database (Mongoose models used):**
  - `GroupAiTask` (server/models/groupAiTask.model.ts) — reads: `find`; **writes:** `deleteOne`
  - `GroupMessage` (server/models/groupMessage.model.ts) — reads: `find`; **writes:** `updateMany`
  - `Group` (server/models/group.model.ts) — reads: `findById`

## Dependencies

- **Internal:**
  - `server/models/group.model.ts` — `Group`
  - `server/models/groupMessage.model.ts` — `GroupMessage`
  - `server/models/groupAiTask.model.ts` — `GroupAiTask`
  - `server/services/taskroomProvision.ts` — `taskroomRequest`, `mintUserToken`
  - `server/services/groupTaskroomActor.ts` — `withTaskroomActor`
  - `server/services/groupSystemMessage.ts` — `writeGroupSystemMessage`
  - `server/services/socket.ts` — `getSocketInstance`
- **Packages:**
  - `mongoose` — `Types`

## Used by

- `server/routes/garageAdminSupportChats.ts`
- `server/routes/groups.ts`
- `server/services/groupTaskAuto.ts`
- `server/services/groupTaskManual.ts`
