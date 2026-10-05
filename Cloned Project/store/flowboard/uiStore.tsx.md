# `store/flowboard/uiStore.tsx`

> React hooks `useSidebarCollapsed`, `useCurrentPage`, `useBreadcrumbs`, `useNotifications`.

**Kind:** client state store · **Lines:** 234

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
| `useUIStore` | const | `= create<UIState>()( persist( (set, get) => ({ // Initial state sidebarCollapsed: false, currentPag…` | 77 |
| `useSidebarCollapsed` | hook | `useSidebarCollapsed()` | 228 |
| `useCurrentPage` | hook | `useCurrentPage()` | 229 |
| `useBreadcrumbs` | hook | `useBreadcrumbs()` | 230 |
| `useNotifications` | hook | `useNotifications()` | 231 |
| `useGlobalLoading` | hook | `useGlobalLoading()` | 232 |
| `useTheme` | hook | `useTheme()` | 233 |

## Interfaces

- **Timers / queues:** `setTimeout` at L150

## Dependencies

- **Internal:** none
- **Packages:**
  - `zustand` — `create`, `persist`, `createJSONStorage`

## Used by

No other file imports this one and it has no automatic entry point — it appears unused (or is loaded dynamically by a path the import graph cannot see).
