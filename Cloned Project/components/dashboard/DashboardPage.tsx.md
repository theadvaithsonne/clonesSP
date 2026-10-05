# `components/dashboard/DashboardPage.tsx`

> React component `DashboardPage`.

**Kind:** React component · **Lines:** 1929 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Button`×23 (components/ui/button.tsx), `Dialog`×6 (components/ui/dialog.tsx), `DialogContent`×6 (components/ui/dialog.tsx), `DialogHeader`×6 (components/ui/dialog.tsx), `DialogTitle`×6 (components/ui/dialog.tsx), `DialogDescription`×6 (components/ui/dialog.tsx), `DialogFooter`×6 (components/ui/dialog.tsx), `AnimatePresence`×6 (framer-motion), `StatCard`×4 (local), `Input`×4 (components/ui/input.tsx), `Badge`×3 (components/ui/badge.tsx), `Crown`×3 (lucide-react), `UserCheck`×3 (lucide-react), `Card`×3 (components/ui/card.tsx), `Row`×3 (local), `Plus`×3 (lucide-react), `Building2`×2 (lucide-react), `UserMinus`×2 (lucide-react), `CardContent`×2 (components/ui/card.tsx), `Users`×2 (lucide-react), `Avatar`×2 (components/ui/avatar.tsx), `AvatarFallback`×2 (components/ui/avatar.tsx), `Tag`×2 (lucide-react), `Select`×2 (components/ui/select.tsx), `SelectTrigger`×2 (components/ui/select.tsx), `SelectValue`×2 (components/ui/select.tsx), `SelectContent`×2 (components/ui/select.tsx), `SelectItem`×2 (components/ui/select.tsx), `Home` (lucide-react), `DashboardContent` (local), `FloorRosterContent` (local), `DropdownMenu` (components/ui/dropdown-menu.tsx), `DropdownMenuTrigger` (components/ui/dropdown-menu.tsx), `MoreVertical` (lucide-react), `DropdownMenuContent` (components/ui/dropdown-menu.tsx), `DropdownMenuItem` (components/ui/dropdown-menu.tsx), `Icon` (local), `CardHeader` (components/ui/card.tsx), `CardTitle` (components/ui/card.tsx), `CardDescription` (components/ui/card.tsx), … +10 more

**Hooks used:** `useState`×28, `useEffect`×3, `useAmIFounder`×2 (lib/hooks/useAmIFounder.ts), `useRef`×2, `useMemo`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (DashboardPage)` | component | `DashboardPage()` | 114 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `DELETE /backend/org/${orgId}/members/${memberId}` (L184)
  - `DELETE /backend/org/${orgId}/members/${memberId}/permanent` (L205)
  - `GET /backend/floors/roster?orgId=${orgId}` (L660)
  - `DELETE /backend/floors/${floorId}?organizationId=${orgId}` (L678)
  - `POST /backend/floors` (L1088)
  - `PATCH /backend/floors/${floor.id}?organizationId=${orgId}` (L1319)
  - `POST /backend/team/bulk-transfer` (L1559)
- **Browser storage / cookies:** `garage_org_id` (localStorage: get)
- **Timers / queues:** `setTimeout` at L1064, L1293

## Dependencies

- **Internal:**
  - `lib/api.ts` — `api`
  - `lib/auth.ts` — `getToken`
  - `components/ui/card.tsx` — `Card`, `CardContent`, `CardDescription`, `CardHeader`, `CardTitle`
  - `components/ui/badge.tsx` — `Badge`
  - `components/ui/button.tsx` — `Button`
  - `components/ui/input.tsx` — `Input`
  - `components/ui/avatar.tsx` — `Avatar`, `AvatarFallback`
  - `components/ui/dialog.tsx` — `Dialog`, `DialogContent`, `DialogDescription`, `DialogFooter`, `DialogHeader`, `DialogTitle`
  - `components/ui/select.tsx` — `Select`, `SelectContent`, `SelectItem`, `SelectTrigger`, `SelectValue`
  - `components/ui/dropdown-menu.tsx` — `DropdownMenu`, `DropdownMenuContent`, `DropdownMenuItem`, `DropdownMenuTrigger`
  - `lib/utils.ts` — `cn`
  - `lib/hooks/useAmIFounder.ts` — `useAmIFounder`
  - `components/shared/LastSeen.tsx` — `LastSeen`
- **Packages:**
  - `react` — `useEffect`, `useState`, `useMemo`, `useRef`
  - `lucide-react` — `Users`, `Crown`, `UserCheck`, `UsersRound`, `Home`, `Building2`, …
  - `sonner` — `toast`
  - `framer-motion` — `motion`, `AnimatePresence`

## Used by

- `app/(dashboard)/layout.tsx`

## Notes

- Large file (1929 lines) — read it by section; line numbers above point into it.
