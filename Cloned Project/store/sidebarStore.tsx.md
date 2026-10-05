# `store/sidebarStore.tsx`

> React hooks `useMvpSidebarItems`, `useProgramManagerSidebarItems`, `useSidebarLoading`, `useSidebarError`.

**Kind:** client state store · **Lines:** 119

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

**Hooks used:** `useSidebarStore`×4 (local)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `SidebarItem` | interface |  | 5 |
| `SidebarState` | interface |  | 11 |
| `useSidebarStore` | const | `= create<SidebarState>()( persist( (set, get) => ({ // Initial state mvpSidebarItems: [], programMa…` | 36 |
| `useMvpSidebarItems` | hook | `useMvpSidebarItems()` | 115 |
| `useProgramManagerSidebarItems` | hook | `useProgramManagerSidebarItems()` | 116 |
| `useSidebarLoading` | hook | `useSidebarLoading()` | 117 |
| `useSidebarError` | hook | `useSidebarError()` | 118 |

## Interfaces

- **Next.js API routes called (same origin):**
  - `GET /api/mvp-sidebar?email=${email}` (L62)
  - `GET /api/program-manager-sidebar?email=${email}` (L80)

## Dependencies

- **Internal:** none
- **Packages:**
  - `zustand` — `create`, `persist`, `createJSONStorage`

## Used by

- `app/(dashboard)/taskroom/components/sidebar.tsx`
