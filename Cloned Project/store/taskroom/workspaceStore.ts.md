# `store/taskroom/workspaceStore.ts`

> Module exporting `Workspace`, `space`, `useWorkspaceStore`.

**Kind:** client state store · **Lines:** 627

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `Workspace` | interface |  | 8 |
| `space` | interface |  | 19 |
| `useWorkspaceStore` | const | `= create<WorkspaceState>((set) => ({ workspaces: [], spaceData: {}, rooms: {}, currentWorkspace: nu…` | 56 |

## Interfaces

- **Other fetch/api calls (target not statically resolvable):**
  - `GET ${process.env.NEXT_PUBLIC_TASKROOM_URL}workspaces/me?size=50` (L88)
  - `GET ${process.env.NEXT_PUBLIC_TASKROOM_URL}workspaces/${workspaceId}` (L110)
  - `POST ${process.env.NEXT_PUBLIC_TASKROOM_URL}workspaces` (L145)
  - `POST ${process.env.NEXT_PUBLIC_TASKROOM_URL}spaces` (L162)
  - `POST ${process.env.NEXT_PUBLIC_TASKROOM_URL}rooms` (L197)
  - `GET ${process.env.NEXT_PUBLIC_TASKROOM_URL}spaces/me?workspaceId=${workspaceId}&page=${page}&size=50` (L287)
  - `GET ${process.env.NEXT_PUBLIC_TASKROOM_URL}spaces?workspaceId=${workspaceId}` (L335)
  - `GET ${process.env.NEXT_PUBLIC_TASKROOM_URL}workspaces?size=50` (L427)
  - `GET ${process.env.NEXT_PUBLIC_TASKROOM_URL}spaces?workspaceId=${activeWorkspaceId}` (L447)
  - `GET ${process.env.NEXT_PUBLIC_TASKROOM_URL}rooms?spaceId=${spaceId}` (L460)
  - `PUT ${process.env.NEXT_PUBLIC_TASKROOM_URL}workspaces/${workspaceId}` (L565)
  - `DELETE ${process.env.NEXT_PUBLIC_TASKROOM_URL}workspaces/${workspaceId}` (L597)
- **Environment variables (`process.env`):** `NEXT_PUBLIC_TASKROOM_URL`
- **Browser storage / cookies:** `garage_tok` (localStorage: get)

## Dependencies

- **Internal:**
  - `store/taskroom/uiStore.tsx` — `useUIStore`
  - `store/taskroom/templateStore.ts` — `useTemplateStore`
- **Packages:**
  - `zustand` — `create`
  - `axios`
  - `js-cookie`
  - `sonner` — `toast`

## Used by

- `app/taskroom/Layout.tsx`
- `app/taskroom/[workspace]/settings/general/[space]/page.tsx`
- `app/taskroom/components/add-workspace-dialog.tsx`
- `app/taskroom/components/taskroom-sidebar.tsx`
- `app/taskroom/components/top-nav.tsx`
- `components/athena/ProjectMangement.tsx`
- `components/athena/components/CreateTaskDialog.tsx`
- `components/athena/components/Dashbaord.tsx`
- `components/athena/components/Gantt.tsx`
- `components/athena/components/ListView.tsx`
- `components/athena/components/card-modal.tsx`
- `components/athena/projectmangerbacku.tsx`
- `components/dashboard/MainSidebar.tsx`
- `components/dashboard/TaskroomWorkspace.tsx`
- `components/dashboard/backOfficeAppSideBar.tsx`
- `components/dashboard/taskroomSiderBar.tsx`
- `store/taskroom/taskroomWorkspace.tsx`
