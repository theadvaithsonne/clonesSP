# `server/services/groupTaskManual.ts`

> src/services/groupTaskManual.ts

**Kind:** backend service · **Lines:** 681

<!-- docgen:auto -->

## Purpose
src/services/groupTaskManual.ts

Tasks a member adds to a linked board BY HAND, and the read/remove surface
that goes with them.

This is the deliberate counterpart to services/groupTaskAuto.ts: the AI path
watches chat and decides what becomes a task; here a person names the task
outright. So there is no chat message and no classifier — the task is filed
straight onto the board, a "… added a task to Taskroom" pill is written, and
a GroupAiTask row records it exactly as an AI capture would (so removal,
listing and the per-board scoping all work unchanged) with `source:"manual"`
and a synthetic `messageId` that points at no real message. That synthetic id
keeps the unique {messageId,itemIndex} guard satisfied with zero migration,
and means the message delete/edit hooks — which look tasks up by a real
message id — simply never match a manual row.
 […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `TaskScope` | type |  | 45 |
| `ManualTaskPerson` | interface |  | 47 |
| `CreateManualTaskInput` | interface |  | 52 |
| `CreateManualTaskResult` | interface |  | 63 |
| `GroupTaskListItem` | interface |  | 76 |
| `ListGroupTasksResult` | interface |  | 94 |
| `createManualTask` | function | `async createManualTask(input: CreateManualTaskInput): Promise<CreateManualTaskResult>` | 206 |
| `listGroupTasks` | function | `async listGroupTasks(input: { groupId: string; actorId: string; scope?: TaskScop…): Promise<ListGroupTasksResult>` | 369 |
| `removeGroupTaskById` | function | `async removeGroupTaskById(input: { groupId: string; actorId: string; taskId: string; …): Promise<{ removed: number; found: number; forbidd…` | 544 |
| `AssignGroupTaskResult` | interface |  | 576 |
| `assignGroupTask` | function | `async assignGroupTask(input: { groupId: string; actorId: string; taskId: string; …): Promise<AssignGroupTaskResult>` — Add one or more Garage members to a task the group already filed. | 599 |

## Interfaces

- **Database (Mongoose models used):**
  - `Group` (server/models/group.model.ts) — reads: `findById`
  - `User` (server/models/user.model.ts) — reads: `find`
  - `GroupAiTask` (server/models/groupAiTask.model.ts) — reads: `find`, `findOne`; **writes:** `create`

## Dependencies

- **Internal:**
  - `server/models/group.model.ts` — `Group`
  - `server/models/groupAiTask.model.ts` — `GroupAiTask`
  - `server/models/user.model.ts` — `User`
  - `server/services/taskroomProvision.ts` — `taskroomRequest`
  - `server/services/groupTaskroomActor.ts` — `NoTaskroomActorError`, `withTaskroomActor`
  - `server/services/groupTaskroom.ts` — `GroupTaskroomError`
  - `server/services/groupSystemMessage.ts` — `writeGroupSystemMessage`
  - `server/services/groupTaskRemoval.ts` — `removeGroupTasks`
  - `server/services/groupTaskAuto.ts` — `BoardGoneError`, `assignTask`, `attachFiles`, `createTaskOnBoard`, `isTrustedFileUrl`
- **Packages:**
  - `mongoose` — `Types`

## Used by

- `server/routes/groups.ts`
- `server/services/supportChatTaskroom.ts`
