# `server/services/supportChatTaskroom.ts`

> Rehan's group-chat Taskroom features, for support/NVC chats.

**Kind:** backend service · **Lines:** 482

<!-- docgen:auto -->

## Purpose
Rehan's group-chat Taskroom features, for support/NVC chats.

Group chats link to a board and file tasks onto it (services/groupTaskroom.ts,
groupTaskManual.ts). Support chats were refused at every step, for good
reasons this file keeps:

  • No member sync. A support chat's members are the customer and their
    upline — they must never be put on an internal board. Tasks are posted as
    the support board owner instead (the link's `linkedBy` + `actorOrgId`,
    honoured by groupTaskroomActor.ts).
  • No pills in the chat. "Added a task to Taskroom: …" would show the
    customer internal titles; groupSystemMessage.ts drops them for support
    chats. Admins see a chat's tasks in the console instead.
  • No AI capture yet. groupTaskAuto's `kind !== "support"` gate stays —
    "we will add AI creation later" (Shorupan, 2026-10-01).
 […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `SupportChatTaskroomInfo` | interface |  | 72 |
| `getSupportChatTaskroom` | function | `async getSupportChatTaskroom(groupId: string): Promise<SupportChatTaskroomInfo>` | 84 |
| `linkSupportChat` | function | `async linkSupportChat(groupId: string, workspaceId: string, roomId: string): Promise<SupportChatTaskroomInfo>` — Point one chat at its own board. | 135 |
| `unlinkSupportChat` | function | `async unlinkSupportChat(groupId: string): Promise<SupportChatTaskroomInfo>` — Drop the chat's own board; it falls back to the shared support board. | 152 |
| `addSupportChatTask` | function | `async addSupportChatTask(input: { groupId: string; actorId: string; title: string; d…)` | 161 |
| `SupportTaskMark` | interface |  | 193 |
| `listSupportTaskMarks` | function | `async listSupportTaskMarks(groupId: string): Promise<SupportTaskMark[]>` | 227 |
| `assignSupportTask` | function | `async assignSupportTask(input: { groupId: string; taskId: string; userId: string; a…): Promise<SupportTaskMark>` — Assign a support task to one of the chat's support staff. | 331 |
| `removeSupportTask` | function | `async removeSupportTask(input: { groupId: string; taskId: string; actorId: string; }): Promise<void>` — Delete a support task from Taskroom — either kind — and forget it. | 412 |
| `shortTaskLink` | function | `async shortTaskLink(groupId: string, taskId: string): Promise<string>` — Short share link (Taskroom's short-URL service), else the long one. | 450 |
| `listSupportChatTasks` | function | `async listSupportChatTasks(groupId: string, actorId: string)` | 472 |
| `removeSupportChatTask` | function | `async removeSupportChatTask(groupId: string, actorId: string, taskId: string)` | 478 |

## Interfaces

- **Database (Mongoose models used):**
  - `Group` (server/models/group.model.ts) — reads: `findOne`; **writes:** `updateOne`
  - `GroupAiTask` (server/models/groupAiTask.model.ts) — reads: `find`, `exists`; **writes:** `updateOne`
- **External hosts mentioned in the code:** `my.garage.app`

## Dependencies

- **Internal:**
  - `server/models/group.model.ts` — `Group`
  - `server/models/groupAiTask.model.ts` — `GroupAiTask`
  - `server/services/taskroomProvision.ts` — `mintUserToken`, `taskroomRequest`
  - `server/services/groupTaskroom.ts` — `GroupTaskroomError`
  - `server/services/groupTaskManual.ts` — `createManualTask`, `listGroupTasks`, `removeGroupTaskById`
  - `server/services/supportTicketTaskroom.ts` — `getSharedSupportBoard`, `resolveBoardAsOwner`, `ResolvedBoard`
- **Packages:**
  - `mongoose` — `Types`

## Used by

- `server/routes/garageAdminSupportChats.ts`
