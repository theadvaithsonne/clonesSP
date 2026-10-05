# `store/taskroom/spaceStore.ts`

> Module exporting `SpaceMember`, `CreateSpaceRequest`, `useSpaceStore`.

**Kind:** client state store · **Lines:** 200

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `SpaceMember` | interface |  | 7 |
| `CreateSpaceRequest` | interface |  | 18 |
| `useSpaceStore` | const | `= create<SpaceState>((set, get) => ({ members: [], isLoading: false, isCreating: false, isAddingMem…` | 42 |

## Interfaces

- **Other fetch/api calls (target not statically resolvable):**
  - `PUT ${process.env.NEXT_PUBLIC_TASKROOM_URL}spaces/${spaceId}` (L53)
  - `DELETE ${process.env.NEXT_PUBLIC_TASKROOM_URL}spaces/${spaceId}` (L86)
  - `GET ${process.env.NEXT_PUBLIC_TASKROOM_URL}space/members?workspace=${workspaceId}&space=${spaceId}` (L115)
  - `POST ${process.env.NEXT_PUBLIC_TASKROOM_URL}space/members` (L141)
  - `POST ${process.env.NEXT_PUBLIC_TASKROOM_URL}spaces` (L169)
- **Environment variables (`process.env`):** `NEXT_PUBLIC_TASKROOM_URL`
- **Browser storage / cookies:** `garage_tok` (localStorage: get)

## Dependencies

- **Internal:**
  - `store/taskroom/taskroomWorkspace.tsx` — `useTaskroomWorkspacetore`
- **Packages:**
  - `zustand` — `create`
  - `axios`
  - `js-cookie`
  - `sonner` — `toast`

## Used by

- `app/taskroom/[workspace]/settings/people/[space]/page.tsx`
- `app/taskroom/components/create-space-dialog.tsx`
- `app/taskroom/components/taskroom-sidebar.tsx`
- `components/athena/components/SpaceSettingsPanel.tsx`
- `components/athena/components/create-space-dialog.tsx`
- `components/athena/components/people.tsx`
- `components/athena/components/workspacesidebar.tsx`
- `components/dashboard/TaskroomWorkspace.tsx`
- `components/dashboard/taskroomSiderBar.tsx`
