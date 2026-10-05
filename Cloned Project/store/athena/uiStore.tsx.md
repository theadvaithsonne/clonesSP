# `store/athena/uiStore.tsx`

> React hooks `useSidebarCollapsed`, `useCurrentPage`, `useBreadcrumbs`, `useNotifications`.

**Kind:** client state store · **Lines:** 244

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

**Hooks used:** `useUIStoreAthena`×6 (local)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `Notification` | interface |  | 5 |
| `Modal` | interface |  | 14 |
| `UIState` | interface |  | 20 |
| `useUIStoreAthena` | const | `= create<UIState>()( persist( (set, get) => ({ // Initial state sidebarCollapsed: false, currentPag…` | 83 |
| `useSidebarCollapsed` | hook | `useSidebarCollapsed()` | 238 |
| `useCurrentPage` | hook | `useCurrentPage()` | 239 |
| `useBreadcrumbs` | hook | `useBreadcrumbs()` | 240 |
| `useNotifications` | hook | `useNotifications()` | 241 |
| `useGlobalLoading` | hook | `useGlobalLoading()` | 242 |
| `useTheme` | hook | `useTheme()` | 243 |

## Interfaces

- **Timers / queues:** `setTimeout` at L157

## Dependencies

- **Internal:** none
- **Packages:**
  - `zustand` — `create`, `persist`, `createJSONStorage`

## Used by

- `components/athena/projectmangerbacku.tsx`
- `components/dashboard/TaskroomWorkspace.tsx`
- `components/dashboard/taskroomSiderBar.tsx`
