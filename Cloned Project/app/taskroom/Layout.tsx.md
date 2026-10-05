# `app/taskroom/Layout.tsx`

> React component `PostLoginLayout`.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 113 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Toaster` (sonner), `WorkspaceLoading` (components/shared/WorkspaceLoading.tsx), `TopNav` (app/taskroom/components/top-nav.tsx), `TaskroomSidebar` (app/taskroom/components/taskroom-sidebar.tsx), `AddWorkspaceDialog` (app/taskroom/components/add-workspace-dialog.tsx)

### Props

- **`PostLoginLayout`**: `children: React.ReactNode`

**Hooks used:** `usePathname` (next/navigation), `useUIStore` (store/taskroom/uiStore.tsx), `useListViewDetailStore` (store/taskroom/listViewDetailStore.ts), `useWorkspaceStore` (store/taskroom/workspaceStore.ts), `useState`, `useRouter` (next/navigation), `useParams` (next/navigation), `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (PostLoginLayout)` | component | `PostLoginLayout({ children, }: { children: React.ReactNode; })` | 20 |

## Interfaces

- **Other fetch/api calls (target not statically resolvable):**
  - `GET ${process.env.NEXT_PUBLIC_TASKROOM_URL}users/profile` (L46)
- **Environment variables (`process.env`):** `NEXT_PUBLIC_TASKROOM_URL`
- **Browser storage / cookies:** `garage_tok` (localStorage: get), `TaskRoomUserDetails` (cookie: set)

## Dependencies

- **Internal:**
  - `app/taskroom/components/taskroom-sidebar.tsx` — `TaskroomSidebar`
  - `app/taskroom/components/add-workspace-dialog.tsx` — `AddWorkspaceDialog`
  - `store/taskroom/uiStore.tsx` — `useUIStore`
  - `app/taskroom/components/task-stage-template-dialog.tsx` — `TaskStageTemplateDialog`
  - `store/taskroom/workspaceStore.ts` — `useWorkspaceStore`
  - `store/taskroom/listViewDetailStore.ts` — `useListViewDetailStore`
  - `app/taskroom/components/top-nav.tsx` — `TopNav`
  - `components/shared/WorkspaceLoading.tsx` — `WorkspaceLoading`
- **Packages:**
  - `react` — `useEffect`, `useState`
  - `next` — `usePathname`, `useRouter`, `useParams`
  - `sonner` — `Toaster`
  - `lucide-react` — `Plus`, `ChevronRight`
  - `js-cookie`

## Used by

No other file imports this one and it has no automatic entry point — it appears unused (or is loaded dynamically by a path the import graph cannot see).
