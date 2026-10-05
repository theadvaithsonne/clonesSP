# `server/services/groupTaskroomActor.ts`

> src/services/groupTaskroomActor.ts

**Kind:** backend service · **Lines:** 106

<!-- docgen:auto -->

## Purpose
src/services/groupTaskroomActor.ts

Who the server acts as when it calls Taskroom on a linked group's behalf.

Taskroom v2 authenticates every call as a person: the Garage JWT must map to
an active tr2_user in the same org, or it answers 401 "Unauthorized". The
server therefore mints a short-lived token for somebody who is known to have
that record, and falls through a list of candidates when one is refused:

  1. `preferUserId` — the person the action is really theirs (the reporter of
     an AI task), when member sync has confirmed their Taskroom account.
  2. The admin who linked the board — they had Taskroom access at link time.
  3. Any other group admin, then the group creator, the sync has confirmed.

A candidate refused with 401 is skipped; any other error is the call's own
failure and is thrown to the caller unchanged.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `NoTaskroomActorError` | class | `extends Error` | 20 |
| `isTaskroomUnauthorized` | function | `isTaskroomUnauthorized(error: unknown): boolean` — Taskroom's auth middleware answers every refusal with exactly "Unauthorized" (401). | 34 |
| `taskroomActorCandidates` | function | `taskroomActorCandidates(group: any, preferUserId?: string): string[]` — Ordered, de-duplicated Garage user ids to act as for this group. | 43 |
| `withTaskroomActor` | function | `async withTaskroomActor(group: any, fn: (token: string, actorUserId: string) => Promise<T>, preferUserId?: string): Promise<{ result: T; actorUserId: string }>` — Run `fn` with a Taskroom token for the first candidate Taskroom accepts. | 85 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `server/services/taskroomProvision.ts` — `mintUserToken`
- **Packages:** none

## Used by

- `server/services/__tests__/groupTaskroom.test.ts`
- `server/services/groupTaskAuto.ts`
- `server/services/groupTaskManual.ts`
- `server/services/groupTaskRemoval.ts`
- `server/services/groupTaskroom.ts`
