# `app/taskroom/components/taskroom-sidebar.tsx`

> React component `TaskroomSidebar`.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 542 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `NavLink`×6 (local), `Plus`×4 (lucide-react), `DropdownMenuItem`×4 (components/ui/dropdown-menu.tsx), `MoreHorizontal`×3 (lucide-react), `ChevronLeft`×2 (lucide-react), `ChevronUp`×2 (lucide-react), `ChevronDown`×2 (lucide-react), `Skeleton`×2 (components/ui/skeleton.tsx), `DropdownMenu`×2 (components/ui/dropdown-menu.tsx), `DropdownMenuTrigger`×2 (components/ui/dropdown-menu.tsx), `DropdownMenuContent`×2 (components/ui/dropdown-menu.tsx), `Edit`×2 (lucide-react), `Trash2`×2 (lucide-react), `SettingSidebar` (app/taskroom/components/setting-sidebar.tsx), `Search` (lucide-react), `SlidersHorizontal` (lucide-react), `Star` (lucide-react), `Users` (lucide-react), `FolderKanban` (lucide-react), `LayoutList` (lucide-react), `CalendarDays` (lucide-react), `CreateSpaceDialog` (app/taskroom/components/create-space-dialog.tsx), `CreateRoomDialog` (app/taskroom/components/create-room-dialog.tsx), `Fixedsidebar` (app/taskroom/components/fixed-sidebar.tsx), `Icon` (local), `Link` (next/link)

**Hooks used:** `useState`×6, `useUIStore`×2 (store/uiStore.tsx), `useParams`×2 (next/navigation), `useWorkspaceStore` (store/taskroom/workspaceStore.ts), `usePathname` (next/navigation), `useTaskroomWorkspacetore` (store/taskroom/taskroomWorkspace.tsx), `useSpaceStore` (store/taskroom/spaceStore.ts), `useSearchParams` (next/navigation), `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `TaskroomSidebar` | component | `TaskroomSidebar()` | 48 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/utils.ts` — `cn`
  - `app/taskroom/components/create-space-dialog.tsx` — `CreateSpaceDialog`
  - `app/taskroom/components/fixed-sidebar.tsx` — `Fixedsidebar (default)`
  - `store/uiStore.tsx` — `useUIStore`
  - `app/taskroom/components/setting-sidebar.tsx` — `SettingSidebar (default)`
  - `store/taskroom/workspaceStore.ts` — `useWorkspaceStore`
  - `components/ui/skeleton.tsx` — `Skeleton`
  - `store/taskroom/taskroomWorkspace.tsx` — `useTaskroomWorkspacetore`, `Room`
  - `app/taskroom/components/create-room-dialog.tsx` — `CreateRoomDialog`
  - `store/taskroom/spaceStore.ts` — `useSpaceStore`
  - `components/ui/dropdown-menu.tsx` — `DropdownMenu`, `DropdownMenuContent`, `DropdownMenuItem`, `DropdownMenuTrigger`
- **Packages:**
  - `react` — `useState`, `useEffect`
  - `lucide-react` — `Plus`, `Inbox`, `MessageSquareReply`, `MessageCircle`, `CheckSquare`, `MoreHorizontal`, …
  - `next` — `usePathname`, `useParams`, `useSearchParams`

## Used by

- `app/taskroom/Layout.tsx`
