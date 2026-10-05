# `server/services/groupTaskroom.ts`

> src/services/groupTaskroom.ts

**Kind:** backend service · **Lines:** 1474

<!-- docgen:auto -->

## Purpose
src/services/groupTaskroom.ts

Links a group chat to a Taskroom board and keeps the board's membership in
step with the group's.

Design constraints this file exists to satisfy:

 1. Taskroom v2 is a separate service we do not own (see taskroomProvision.ts).
    Every call below is one the Taskroom UI already makes, with the same
    payload shape, so a linked board is indistinguishable from a hand-made one.

 2. The group decides who belongs on the board, but a linked board may have
    had members of its own. The sync therefore only ever REMOVES people it
    added itself (`taskroom.members[].addedBySync`), and never the admin who
    linked it — whoever was on an existing board keeps their access whatever
    happens in the chat. […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `TASKROOM_ACCOUNT_MISSING_MESSAGE` | const | `= "Open Taskroom once to set up your account, then try again"` | 60 |
| `GroupTaskroomLinkMode` | type |  | 68 |
| `GroupTaskroomSummary` | interface | The `taskroom` block of GET /groups/:groupId. | 74 |
| `GroupTaskroomMemberEntry` | interface | One row of `Group.taskroom.members`, ids as strings. | 100 |
| `GroupTaskroomError` | class | `extends Error` — A link request that could not be carried out, with the status the route answers with. | 114 |
| `pickLandingStageId` | function | `pickLandingStageId(stages: any[]): string \| null` — The column new tasks land in: the board's first "tostart" column (Backlog on a fresh board), else its first column. | 224 |
| `TaskroomAccount` | interface |  | 241 |
| `pickTaskroomAccounts` | function | `pickTaskroomAccounts(records: any[], emailByUserId: Map<string, string \| null \| undefined>): Map<string, TaskroomAccount>` — Pick each person's Taskroom account out of the org's tr2_users. | 258 |
| `MemberSyncPlan` | interface |  | 287 |
| `planMemberSync` | function | `planMemberSync(desiredUserIds: string[], currentEntries: Pick< GroupTaskroomMemberEntry, "userId" \| …, roomMemberTaskroomIds: Iterable<string>, taskroomIdByUserId: Map<string, string>, link…` — The diff between the group and the board. | 306 |
| `linkGroupTaskroom` | function | `async linkGroupTaskroom(input: { groupId: string; actorId: string; mode: GroupTaskr…): Promise<GroupTaskroomSummary>` — Link a group to a Taskroom board, replacing any existing link (the old board is left exactly as it is). | 699 |
| `unlinkGroupTaskroom` | function | `async unlinkGroupTaskroom(groupId: string, actorId: string): Promise<boolean>` — Remove the link. The board, its tasks and everyone on it are left untouched — unlinking stops the chat feeding the board, it does not take the board away from anyone. | 805 |
| `setGroupTaskroomEnabled` | function | `async setGroupTaskroomEnabled(groupId: string, enabled: boolean): Promise<GroupTaskroomSummary \| undefined>` — Turn AI task capture on or off. | 820 |
| `requestGroupTaskroomSync` | function | `requestGroupTaskroomSync(groupId: string): void` — Bring the linked board's membership in line with the group's. | 890 |
| `serializeGroupTaskroom` | function | `async serializeGroupTaskroom(group: any): Promise<GroupTaskroomSummary \| undefined>` — The `taskroom` block for GET /groups/:groupId, or undefined when the group is not linked. | 1418 |

## Interfaces

- **Database (Mongoose models used):**
  - `User` (server/models/user.model.ts) — reads: `findById`, `find`
  - `Group` (server/models/group.model.ts) — reads: `findById`; **writes:** `updateOne`

## Dependencies

- **Internal:**
  - `server/models/group.model.ts` — `Group`
  - `server/models/user.model.ts` — `User`
  - `server/services/taskroomProvision.ts` — `mintUserToken`, `taskroomRequest`, `TaskroomRole`
  - `server/services/groupTaskroomActor.ts` — `NoTaskroomActorError`, `isTaskroomUnauthorized`, `withTaskroomActor`
  - `server/services/groupSystemMessage.ts` — `writeGroupSystemMessage`
  - `server/services/supportChat.ts` — `isSupportGroup`
- **Packages:**
  - `mongoose` — `Types`

## Used by

- `server/index.ts`
- `server/routes/groups.ts`
- `server/services/__tests__/groupTaskroom.test.ts`
- `server/services/groupTaskAuto.ts`
- `server/services/groupTaskManual.ts`
- `server/services/memberCleanup.service.ts`
- `server/services/supportChatTaskroom.ts`
- `server/services/supportTicketTaskroom.ts`
