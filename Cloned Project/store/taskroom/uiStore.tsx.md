# `store/taskroom/uiStore.tsx`

> React hooks `useSidebarCollapsed`, `useCurrentPage`, `useBreadcrumbs`, `useNotifications`.

**Kind:** client state store · **Lines:** 248

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

**Hooks used:** `useUIStore`×6 (local)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `Notification` | interface |  | 5 |
| `Modal` | interface |  | 14 |
| `UIState` | interface |  | 20 |
| `useUIStore` | const | `= create<UIState>()( persist( (set, get) => ({ // Initial state sidebarCollapsed: false, currentPag…` | 85 |
| `useSidebarCollapsed` | hook | `useSidebarCollapsed()` | 242 |
| `useCurrentPage` | hook | `useCurrentPage()` | 243 |
| `useBreadcrumbs` | hook | `useBreadcrumbs()` | 244 |
| `useNotifications` | hook | `useNotifications()` | 245 |
| `useGlobalLoading` | hook | `useGlobalLoading()` | 246 |
| `useTheme` | hook | `useTheme()` | 247 |

## Interfaces

- **Timers / queues:** `setTimeout` at L160

## Dependencies

- **Internal:** none
- **Packages:**
  - `zustand` — `create`, `persist`, `createJSONStorage`

## Used by

- `app/taskroom/Layout.tsx`
- `app/taskroom/components/top-nav.tsx`
- `app/taskroom/invalid-workspace/page.tsx`
- `components/athena/components/add-workspace-dialog.tsx`
- `components/athena/components/workspacesidebar.tsx`
- `components/dashboard/TaskroomWorkspace.tsx`
- `store/taskroom/taskroomWorkspace.tsx`
- `store/taskroom/workspaceStore.ts`
