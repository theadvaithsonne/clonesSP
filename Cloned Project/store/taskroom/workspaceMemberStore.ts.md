# `store/taskroom/workspaceMemberStore.ts`

> Module exporting `WorkspaceMember`, `useWorkspaceMemberStore`.

**Kind:** client state store · **Lines:** 202

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `WorkspaceMember` | interface |  | 6 |
| `useWorkspaceMemberStore` | const | `= create<WorkspaceMemberState>((set, get) => ({ members: [], metadata: null, isLoading: false, isLo…` | 48 |

## Interfaces

- **Other fetch/api calls (target not statically resolvable):**
  - `GET ${process.env.NEXT_PUBLIC_TASKROOM_URL}workspace/members?workspaceId=${workspaceId}&page=${page}&size=50&search=${search}` (L82)
  - `GET ${process.env.NEXT_PUBLIC_TASKROOM_URL}workspace/members?spaceId=${spaceId}` (L127)
  - `DELETE ${process.env.NEXT_PUBLIC_TASKROOM_URL}workspace/members/${memberId}` (L172)
- **Environment variables (`process.env`):** `NEXT_PUBLIC_TASKROOM_URL`
- **Browser storage / cookies:** `garage_tok` (localStorage: get)

## Dependencies

- **Internal:** none
- **Packages:**
  - `zustand` — `create`
  - `axios`

## Used by

- `app/taskroom/[workspace]/settings/people/[space]/page.tsx`
- `app/taskroom/components/create-room-dialog.tsx`
- `app/taskroom/components/create-space-dialog.tsx`
- `components/athena/components/WorkspacePeopleDashboard.tsx`
- `components/athena/components/create-space-dialog.tsx`
- `components/athena/components/people.tsx`
- `components/dashboard/TaskroomWorkspace.tsx`
