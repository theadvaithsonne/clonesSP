# `components/dashboard/TaskroomWorkspace.tsx`

> React component `TaskroomWorkspace`.

**Kind:** React component · **Lines:** 585 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Plus`×2 (lucide-react), `Search`×2 (lucide-react), `Skeleton`×2 (components/ui/skeleton.tsx), `Image` (next/image), `X` (lucide-react), `FolderOpen` (lucide-react), `AddWorkspaceDialog` (components/athena/components/add-workspace-dialog.tsx), `CreateSpaceDialog` (components/athena/components/create-space-dialog.tsx), `CreateRoomDialog` (components/athena/components/create-room-dialog.tsx)

### Props

- **`TaskroomWorkspace`**: `setActivePopover`, `setActiveItem`

**Hooks used:** `useState`×13, `useUIStore`×3 (store/taskroom/uiStore.tsx), `useWorkspaceStore`×2 (store/taskroom/workspaceStore.ts), `useUserStore`×2 (store/athena/userStore.ts), `useEffect`×2, `usePathname` (next/navigation), `useTaskroomWorkspacetore` (store/taskroom/taskroomWorkspace.tsx), `useSpaceStore` (store/taskroom/spaceStore.ts), `useParams` (next/navigation), `useSearchParams` (next/navigation), `useWorkspaceMemberStore` (store/taskroom/workspaceMemberStore.ts), `useRouter` (next/navigation), `useUIStoreAthena` (store/athena/uiStore.tsx)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `TaskroomWorkspace` | component | `TaskroomWorkspace({ setActivePopover, setActiveItem })` | 69 |

## Interfaces

- **Other fetch/api calls (target not statically resolvable):**
  - `GET ${baseUrl}workspaces/me?size=50&searchData=${encodeURIComponent(query)}` (L151)
- **Environment variables (`process.env`):** `NEXT_PUBLIC_TASKROOM_URL`
- **Browser storage / cookies:** `garage_tok` (localStorage: get)
- **External hosts mentioned in the code:** `uatapi.garage.app`

## Dependencies

- **Internal:**
  - `components/athena/components/add-workspace-dialog.tsx` — `AddWorkspaceDialog`
  - `store/taskroom/workspaceMemberStore.ts` — `useWorkspaceMemberStore`
  - `lib/utils.ts` — `cn`
  - `components/athena/components/create-space-dialog.tsx` — `CreateSpaceDialog`
  - `components/athena/components/create-room-dialog.tsx` — `CreateRoomDialog`
  - `store/taskroom/uiStore.tsx` — `useUIStore`
  - `store/athena/uiStore.tsx` — `useUIStoreAthena`
  - `store/taskroom/workspaceStore.ts` — `useWorkspaceStore`
  - `components/ui/skeleton.tsx` — `Skeleton`
  - `store/taskroom/taskroomWorkspace.tsx` — `useTaskroomWorkspacetore`, `Room`
  - `store/taskroom/spaceStore.ts` — `useSpaceStore`
  - `store/athena/userStore.ts` — `useUserStore`
  - `components/ui/dropdown-menu.tsx` — `DropdownMenu`, `DropdownMenuContent`, `DropdownMenuItem`, `DropdownMenuTrigger`
- **Packages:**
  - `react` — `useState`, `useEffect`
  - `lucide-react` — `Plus`, `Inbox`, `SquareArrowLeft`, `MessageSquareReply`, `MessageCircle`, `CheckSquare`, …
  - `next` — `usePathname`, `useParams`, `useSearchParams`, `useRouter`
  - `js-cookie`
  - `axios`

## Used by

- `components/dashboard/backOfficeAppSideBar.tsx`
