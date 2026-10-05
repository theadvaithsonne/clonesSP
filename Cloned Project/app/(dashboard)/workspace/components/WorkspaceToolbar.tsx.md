# `app/(dashboard)/workspace/components/WorkspaceToolbar.tsx`

> React component `WorkspaceToolbar`.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 465 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Button`×2 (components/ui/button.tsx), `Users` (lucide-react), `ChevronDown` (lucide-react), `AnimatePresence` (framer-motion), `X` (lucide-react)

### Props

- **`WorkspaceToolbar`**: `className?: string`

**Hooks used:** `useState`×10, `useEffect`×4, `useRef`×3, `useLayoutEffect`×2, `useCallback`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `WorkspaceToolbar` | component | `WorkspaceToolbar({ className }: WorkspaceToolbarProps)` | 37 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/team/list?orgId=${orgId}` (L95)
- **Socket.IO events:**
  - emits: `workspace:request-sync`
  - listens for: `workspace:users`, `workspace:full-sync`, `workspace:user-joined`, `workspace:user-left`, `workspace:user-status-changed`
- **Browser storage / cookies:** `garage_org_id` (localStorage: get)
- **Timers / queues:** `setInterval` at L78

## Dependencies

- **Internal:**
  - `components/ui/button.tsx` — `Button`
  - `lib/utils.ts` — `cn`
  - `lib/socket.ts` — `connectSocket`
  - `lib/api.ts` — `api`
  - `lib/auth.ts` — `getToken`
  - `components/dashboard/NotificationsHub.tsx` — `NotificationsHub (default)`
  - `components/dashboard/TodoMenu.tsx` — `TodoMenu`
- **Packages:**
  - `react` — `useState`, `useEffect`, `useRef`, `useCallback`, `useLayoutEffect`
  - `react-dom` — `createPortal`
  - `lucide-react` — `Bell`, `Users`, `CheckSquare`, `ChevronDown`, `X`
  - `framer-motion` — `motion`, `AnimatePresence`

## Used by

- `app/(dashboard)/layout.tsx`
