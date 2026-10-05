# `components/dashboard/calendar/CreateEventModal.tsx`

> React component `CreateEventModal`.

**Kind:** React component · **Lines:** 636 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Input`×7 (components/ui/input.tsx), `Label`×6 (components/ui/label.tsx), `Badge`×3 (components/ui/badge.tsx), `Button`×3 (components/ui/button.tsx), `Plus`×2 (lucide-react), `Checkbox`×2 (components/ui/checkbox.tsx), `AnimatePresence`×2 (framer-motion), `X`×2 (lucide-react), `Loader2`×2 (lucide-react), `Mail`×2 (lucide-react), `Dialog` (components/ui/dialog.tsx), `DialogContent` (components/ui/dialog.tsx), `DialogHeader` (components/ui/dialog.tsx), `DialogTitle` (components/ui/dialog.tsx), `DialogDescription` (components/ui/dialog.tsx), `Textarea` (components/ui/textarea.tsx), `Calendar` (lucide-react), `Clock` (lucide-react), `Repeat` (lucide-react), `Users` (lucide-react), `UserPlus` (lucide-react), `DialogFooter` (components/ui/dialog.tsx)

### Props

- **`CreateEventModal`**: `open: boolean`, `onClose: () => void`, `onEventCreated: () => void`

**Hooks used:** `useState`×14, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `CreateEventModal` | component | `CreateEventModal({ open, onClose, onEventCreated, }: CreateEventModalProps)` | 50 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/team/list?orgId=${orgId}` (L98)
  - `POST /backend/events?orgId=${orgId}` (L201)
- **Browser storage / cookies:** `garage_org_id` (localStorage: get)

## Dependencies

- **Internal:**
  - `components/ui/dialog.tsx` — `Dialog`, `DialogContent`, `DialogDescription`, `DialogFooter`, `DialogHeader`, `DialogTitle`
  - `components/ui/button.tsx` — `Button`
  - `components/ui/input.tsx` — `Input`
  - `components/ui/label.tsx` — `Label`
  - `components/ui/textarea.tsx` — `Textarea`
  - `components/ui/badge.tsx` — `Badge`
  - `components/ui/checkbox.tsx` — `Checkbox`
  - `lib/api.ts` — `api`
  - `lib/auth.ts` — `getToken`
  - `lib/utils.ts` — `cn`
- **Packages:**
  - `react` — `useState`, `useEffect`
  - `sonner` — `toast`
  - `lucide-react` — `Calendar`, `Clock`, `Users`, `X`, `Loader2`, `Plus`, …
  - `framer-motion` — `motion`, `AnimatePresence`

## Used by

- `components/dashboard/CalendarPage.tsx`
