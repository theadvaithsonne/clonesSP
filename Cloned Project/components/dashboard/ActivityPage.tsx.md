# `components/dashboard/ActivityPage.tsx`

> React component `ActivityPage`.

**Kind:** React component · **Lines:** 464 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Activity`×3 (lucide-react), `Users`×2 (lucide-react), `Button`×2 (components/ui/button.tsx), `RefreshCw`×2 (lucide-react), `LogIn` (lucide-react), `LogOut` (lucide-react), `Wifi` (lucide-react), `WifiOff` (lucide-react), `ClipboardCheck` (lucide-react), `Calendar` (lucide-react), `UserCheck` (lucide-react), `FileText` (lucide-react), `Bot` (lucide-react), `X` (lucide-react), `Search` (lucide-react), `Input` (components/ui/input.tsx), `Clock` (lucide-react)

### Props

- **`ActivityPage`**: `onClose?: () => void`

**Hooks used:** `useState`×6, `useEffect`×4, `useRef`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (ActivityPage)` | component | `ActivityPage({ onClose }: { onClose?: () => void })` | 133 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/user-activity/org?orgId=${orgId}` (L149)
  - `GET /backend/user-activity/org/unread-count?orgId=${orgId}` (L169)
  - `POST /backend/user-activity/read` (L186)
- **Socket.IO events:**
  - emits: `activity:join`, `activity:leave`
  - listens for: `activity:new`
- **Browser storage / cookies:** `garage_org_id` (localStorage: get)
- **Timers / queues:** `setTimeout` at L237

## Dependencies

- **Internal:**
  - `lib/api.ts` — `api`
  - `lib/auth.ts` — `getToken`
  - `lib/socket.ts` — `connectSocket`
  - `components/ui/button.tsx` — `Button`
  - `components/ui/input.tsx` — `Input`
  - `lib/utils.ts` — `cn`
- **Packages:**
  - `react` — `useEffect`, `useRef`, `useState`
  - `lucide-react` — `Activity`, `Users`, `FileText`, `Clock`, `RefreshCw`, `Filter`, …
  - `framer-motion` — `motion`

## Used by

- `app/(dashboard)/layout.tsx`
