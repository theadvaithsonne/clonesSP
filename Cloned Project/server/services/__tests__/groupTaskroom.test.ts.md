# `server/services/__tests__/groupTaskroom.test.ts`

> Group chat × Taskroom: the member-sync diff, the pickers it relies on, the per-group run queue, and one reconcile pass against an in-memory stand-in for the Taskroom endpoints it calls (no network, no database).

**Kind:** test · **Lines:** 801

<!-- docgen:auto -->

## Purpose
Group chat × Taskroom: the member-sync diff, the pickers it relies on, the
per-group run queue, and one reconcile pass against an in-memory stand-in
for the Taskroom endpoints it calls (no network, no database).

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Test cases (31)

- **planMemberSync**
  - keeps people already on the board and adds the rest
  - keeps addedBySync only for people an earlier run put on the board
  - removes a former member only when the sync added them and they are still on
  - never removes the admin who linked the board
  - de-duplicates members and entries
- **pickLandingStageId**
  - lands on Backlog on a fresh board, where every default column has orderId 1
  - prefers the lowest-ordered tostart column
  - falls back to the lowest-ordered column, keeping Taskroom's order on ties
  - is null for a board without columns
- **pickTaskroomAccounts**
  - prefers the exact-email account, the one Taskroom's auth resolves
  - falls back to a case-insensitive match
  - ignores an account under an address the person no longer has
  - uses the only candidate there is when the person has no email
- **requestGroupTaskroomSync queue**
  - runs once more when asked mid-run, however many times it was asked
  - ignores ids that are not ObjectIds, without throwing
- **serializeGroupTaskroom**
  - is undefined for an unlinked group
  - counts only people still in the group and names the failures
- **member sync against Taskroom**
  - walks new people onto the board level by level and records who it added
  - takes a leaver off only if the sync put them on, and never the linker
  - falls back to one-by-one when Taskroom refuses a batch, so one bad record costs one person
  - marks the link broken when the board was deleted
- **linkGroupTaskroom**
  - answers 409 when the admin has no Taskroom account in this org yet
  - new-workspace: creates the workspace, the Group Chats space and a private board
  - takes back what it created when a later step fails
  - new-board: files the board in the admin's existing Group Chats space
  - new-board: refuses a workspace the admin isn't a member of
  - **existing-board**
    - refuses a deleted board
    - refuses a board from another org
    - refuses a board outside the picked workspace
    - refuses a board the admin is not on, even when the search matches someone
    - keeps what the sync knows when the same board is linked again

## Exports

None — this file exports nothing.

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `server/models/group.model.ts` — `Group`
  - `server/models/user.model.ts` — `User`
  - `server/services/taskroomProvision.ts` — `mintUserToken`, `taskroomRequest`
  - `server/services/groupTaskroomActor.ts` — `withTaskroomActor`
  - `server/services/groupSystemMessage.ts` — `writeGroupSystemMessage`
  - `server/services/groupTaskroom.ts` — `TASKROOM_ACCOUNT_MISSING_MESSAGE`, `linkGroupTaskroom`, `pickLandingStageId`, `pickTaskroomAccounts`, `planMemberSync`, `requestGroupTaskroomSync`, `serializeGroupTaskroom`
- **Packages:**
  - `mongoose` — `Types`

## Used by

No other file imports this one and it has no automatic entry point — it appears unused (or is loaded dynamically by a path the import graph cannot see).
