# `components/dashboard/FloorRoster.tsx`

> React component `FloorRosterPage`.

**Kind:** React component · **Lines:** 1386 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Button`×18 (components/ui/button.tsx), `AnimatePresence`×6 (framer-motion), `Dialog`×4 (components/ui/dialog.tsx), `DialogContent`×4 (components/ui/dialog.tsx), `DialogHeader`×4 (components/ui/dialog.tsx), `DialogTitle`×4 (components/ui/dialog.tsx), `DialogDescription`×4 (components/ui/dialog.tsx), `DialogFooter`×4 (components/ui/dialog.tsx), `Input`×4 (components/ui/input.tsx), `Plus`×3 (lucide-react), `Avatar`×2 (components/ui/avatar.tsx), `AvatarFallback`×2 (components/ui/avatar.tsx), `Badge`×2 (components/ui/badge.tsx), `Tag`×2 (lucide-react), `Select`×2 (components/ui/select.tsx), `SelectTrigger`×2 (components/ui/select.tsx), `SelectValue`×2 (components/ui/select.tsx), `SelectContent`×2 (components/ui/select.tsx), `SelectItem`×2 (components/ui/select.tsx), `Building2` (lucide-react), `ArrowRightLeft` (lucide-react), `Card` (components/ui/card.tsx), `Users` (lucide-react), `Edit2` (lucide-react), `Trash2` (lucide-react), `LastSeen` (components/shared/LastSeen.tsx), `Inbox` (lucide-react), `AddFloorDialog` (local), `ChangeAssignmentsDialog` (local), `EditFloorDialog` (local)

**Hooks used:** `useState`×22, `useEffect`×2, `useRef`×2, `useAmIFounder` (lib/hooks/useAmIFounder.ts), `useMemo`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (FloorRosterPage)` | component | `FloorRosterPage()` | 79 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/floors/roster?orgId=${orgId}` (L103)
  - `DELETE /backend/floors/${floorId}?organizationId=${orgId}` (L121)
  - `POST /backend/floors` (L532)
  - `PATCH /backend/floors/${floor.id}?organizationId=${orgId}` (L764)
  - `POST /backend/team/bulk-transfer` (L1004)
- **Browser storage / cookies:** `garage_org_id` (localStorage: get)
- **Timers / queues:** `setTimeout` at L508, L738

## Dependencies

- **Internal:**
  - `lib/api.ts` — `api`
  - `lib/auth.ts` — `getToken`, `getOrgId`
  - `components/ui/card.tsx` — `Card`
  - `components/ui/button.tsx` — `Button`
  - `components/ui/input.tsx` — `Input`
  - `components/ui/avatar.tsx` — `Avatar`, `AvatarFallback`
  - `components/ui/badge.tsx` — `Badge`
  - `components/ui/dialog.tsx` — `Dialog`, `DialogContent`, `DialogDescription`, `DialogFooter`, `DialogHeader`, `DialogTitle`, `DialogTrigger`
  - `components/ui/select.tsx` — `Select`, `SelectContent`, `SelectItem`, `SelectTrigger`, `SelectValue`
  - `lib/utils.ts` — `cn`
  - `lib/hooks/useAmIFounder.ts` — `useAmIFounder`
  - `components/shared/LastSeen.tsx` — `LastSeen`
- **Packages:**
  - `react` — `useEffect`, `useState`, `useMemo`, `useRef`
  - `lucide-react` — `Building2`, `Users`, `Inbox`, `Plus`, `Tag`, `ArrowRightLeft`, …
  - `sonner` — `toast`
  - `framer-motion` — `motion`, `AnimatePresence`

## Used by

No other file imports this one and it has no automatic entry point — it appears unused (or is loaded dynamically by a path the import graph cannot see).
