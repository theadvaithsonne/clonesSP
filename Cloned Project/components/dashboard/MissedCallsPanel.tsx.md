# `components/dashboard/MissedCallsPanel.tsx`

> React component `MissedCallsPanel`.

**Kind:** React component · **Lines:** 226 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `PhoneOff` (lucide-react), `Button` (components/ui/button.tsx), `Loader2` (lucide-react), `Avatar` (components/ui/avatar.tsx), `AvatarImage` (components/ui/avatar.tsx), `AvatarFallback` (components/ui/avatar.tsx), `X` (lucide-react)

**Hooks used:** `useState`×3, `useCallback`×3, `useEffect`×2

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (MissedCallsPanel)` | component | `MissedCallsPanel()` | 47 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/missed-calls?limit=50` (L54)
  - `POST /backend/missed-calls/mark-viewed` (L61)
  - `DELETE /backend/missed-calls/${id}` (L115)
  - `POST /backend/missed-calls/clear` (L134)
- **Socket.IO events:**
  - listens for: `missed-call:new`
- **Timers / queues:** `setTimeout` at L98

## Dependencies

- **Internal:**
  - `components/ui/avatar.tsx` — `Avatar`, `AvatarFallback`, `AvatarImage`
  - `components/ui/button.tsx` — `Button`
  - `lib/api.ts` — `api`
  - `lib/auth.ts` — `getToken`
  - `lib/socket.ts` — `connectSocket`
- **Packages:**
  - `react` — `useCallback`, `useEffect`, `useState`
  - `lucide-react` — `PhoneOff`, `X`, `Loader2`
  - `sonner` — `toast`

## Used by

- `components/dashboard/NotificationPage.tsx`
