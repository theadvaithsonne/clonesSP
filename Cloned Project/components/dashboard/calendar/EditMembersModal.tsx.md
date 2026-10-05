# `components/dashboard/calendar/EditMembersModal.tsx`

> React component `EditMembersModal`.

**Kind:** React component · **Lines:** 541 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Badge`×7 (components/ui/badge.tsx), `UserPlus`×3 (lucide-react), `Mail`×3 (lucide-react), `Button`×3 (components/ui/button.tsx), `Users`×2 (lucide-react), `Label`×2 (components/ui/label.tsx), `Input`×2 (components/ui/input.tsx), `AnimatePresence`×2 (framer-motion), `X`×2 (lucide-react), `Loader2`×2 (lucide-react), `Dialog` (components/ui/dialog.tsx), `DialogContent` (components/ui/dialog.tsx), `DialogHeader` (components/ui/dialog.tsx), `DialogTitle` (components/ui/dialog.tsx), `DialogDescription` (components/ui/dialog.tsx), `UserMinus` (lucide-react), `DialogFooter` (components/ui/dialog.tsx), `Save` (lucide-react)

### Props

- **`EditMembersModal`**: `open: boolean`, `event: CalendarEvent | null`, `onClose: () => void`, `onMembersUpdated: () => void`

**Hooks used:** `useState`×9, `useEffect`, `useMemo`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `EditMembersModal` | component | `EditMembersModal({ open, event, onClose, onMembersUpdated, }: EditMembersMod…)` | 54 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/team/list?orgId=${orgId}` (L97)
  - `PATCH /backend/events/${event._id}/members?orgId=${orgId}` (L189)
- **Browser storage / cookies:** `garage_org_id` (localStorage: get)

## Dependencies

- **Internal:**
  - `components/ui/dialog.tsx` — `Dialog`, `DialogContent`, `DialogDescription`, `DialogFooter`, `DialogHeader`, `DialogTitle`
  - `components/ui/button.tsx` — `Button`
  - `components/ui/input.tsx` — `Input`
  - `components/ui/label.tsx` — `Label`
  - `components/ui/badge.tsx` — `Badge`
  - `lib/api.ts` — `api`
  - `lib/auth.ts` — `getToken`
  - `lib/utils.ts` — `cn`
  - `lib/calendarUtils.ts` — `CalendarEvent`, `(types only)`
- **Packages:**
  - `react` — `useState`, `useEffect`, `useMemo`
  - `sonner` — `toast`
  - `lucide-react` — `Users`, `X`, `Loader2`, `Mail`, `UserPlus`, `UserMinus`, …
  - `framer-motion` — `motion`, `AnimatePresence`

## Used by

- `components/dashboard/CalendarPage.tsx`
