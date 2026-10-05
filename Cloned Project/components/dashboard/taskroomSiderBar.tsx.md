# `components/dashboard/taskroomSiderBar.tsx`

> React component `TaskroomSidebar`.

**Kind:** React component · **Lines:** 1066 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `DropdownMenuItem`×7 (components/ui/dropdown-menu.tsx), `Skeleton`×6 (components/ui/skeleton.tsx), `Edit`×5 (lucide-react), `NavLinkGobal`×4 (local), `MoreHorizontal`×4 (lucide-react), `Plus`×2 (lucide-react), `DropdownMenu`×2 (components/ui/dropdown-menu.tsx), `DropdownMenuTrigger`×2 (components/ui/dropdown-menu.tsx), `DropdownMenuContent`×2 (components/ui/dropdown-menu.tsx), `Trash2`×2 (lucide-react), `ChevronDown`×2 (lucide-react), `Icon`×2 (local), `SquareArrowLeft` (lucide-react), `FolderKanban` (lucide-react), `CreateSpaceDialog` (components/athena/components/create-space-dialog.tsx), `CreateRoomDialog` (components/athena/components/create-room-dialog.tsx), `SpaceMembersDialog` (components/athena/components/space-members-dialog.tsx), `RoomMembersDialog` (components/athena/components/room-members-dialog.tsx), `Link` (next/link)

### Props

- **`TaskroomSidebar`**: `setActiveItem`, `setActivePopover`

**Hooks used:** `useState`×11, `useDashboardStore`×4 (store/athena/dashboardStore.ts), `useWorkspaceStore`×2 (store/taskroom/workspaceStore.ts), `useTaskroomWorkspacetore`×2 (store/taskroom/taskroomWorkspace.tsx), `useUserStore`×2 (store/athena/userStore.ts), `useEffect`×2, `usePathname` (next/navigation), `useSpaceStore` (store/taskroom/spaceStore.ts), `useParams` (next/navigation), `useSearchParams` (next/navigation), `useRouter` (next/navigation), `useBoardStore` (store/athena/boardStore.tsx), `useMobileSidebar` (lib/mobile-sidebar-context.tsx), `useTemplateStore` (store/taskroom/templateStore.ts)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `Card` | interface |  | 65 |
| `Column` | interface |  | 105 |
| `TaskroomSidebar` | component | `TaskroomSidebar({ setActiveItem, setActivePopover })` | 156 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/utils.ts` — `cn`
  - `components/athena/components/create-space-dialog.tsx` — `CreateSpaceDialog`
  - `store/athena/uiStore.tsx` — `useUIStoreAthena`
  - `store/taskroom/workspaceStore.ts` — `useWorkspaceStore`
  - `components/ui/skeleton.tsx` — `Skeleton`
  - `store/taskroom/taskroomWorkspace.tsx` — `useTaskroomWorkspacetore`, `Room`
  - `components/athena/components/create-room-dialog.tsx` — `CreateRoomDialog`
  - `store/taskroom/spaceStore.ts` — `useSpaceStore`
  - `store/taskroom/templateStore.ts` — `useTemplateStore`
  - `store/athena/userStore.ts` — `useUserStore`
  - `components/ui/dropdown-menu.tsx` — `DropdownMenu`, `DropdownMenuContent`, `DropdownMenuItem`, `DropdownMenuTrigger`
  - `store/athena/boardStore.tsx` — `useBoardStore`
  - `lib/mobile-sidebar-context.tsx` — `useMobileSidebar`
  - `store/athena/dashboardStore.ts` — `useDashboardStore`
  - `components/athena/components/space-members-dialog.tsx` — `SpaceMembersDialog`
  - `components/athena/components/room-members-dialog.tsx` — `RoomMembersDialog`
- **Packages:**
  - `react` — `useState`, `useEffect`
  - `lucide-react` — `Plus`, `Inbox`, `MessageSquareReply`, `MessageCircle`, `CheckSquare`, `MoreHorizontal`, …
  - `next` — `usePathname`, `useParams`, `useSearchParams`, `useRouter`
  - `js-cookie`

## Used by

- `components/dashboard/backOfficeAppSideBar.tsx`
