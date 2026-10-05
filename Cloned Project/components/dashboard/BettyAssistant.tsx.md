# `components/dashboard/BettyAssistant.tsx`

> React component `BettyAssistant`.

**Kind:** React component · **Lines:** 124 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Avatar` (components/ui/avatar.tsx), `AvatarFallback` (components/ui/avatar.tsx), `Activity` (lucide-react)

### Props

- **`BettyAssistant`**: `collapsed: boolean`, `isActivityOpen: boolean`, `setIsActivityOpen: (open: boolean) => void`, `setIsAskCabinetOpen: (open: boolean) => void`

**Hooks used:** `useEffect`×3, `useState`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `BettyAssistant` | component | `BettyAssistant({ collapsed, isActivityOpen, setIsActivityOpen, setIsAskCab…)` | 18 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/user-activity/unread-count?orgId=${orgId}` (L32)
- **Socket.IO events:**
  - emits: `activity:join`, `activity:leave`
  - listens for: `activity:new`
- **Browser storage / cookies:** `garage_org_id` (localStorage: get)

## Dependencies

- **Internal:**
  - `lib/utils.ts` — `cn`
  - `components/ui/avatar.tsx` — `Avatar`, `AvatarFallback`
  - `lib/api.ts` — `api`
  - `lib/auth.ts` — `getToken`
  - `lib/socket.ts` — `connectSocket`
- **Packages:**
  - `react` — `useState`, `useEffect`, `useRef`
  - `lucide-react` — `Activity`, `Wifi`, `WifiOff`

## Used by

- `components/dashboard/MainSidebar.tsx`
