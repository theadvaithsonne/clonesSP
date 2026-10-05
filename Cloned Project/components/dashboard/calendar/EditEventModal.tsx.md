# `components/dashboard/calendar/EditEventModal.tsx`

> React component `EditEventModal`.

**Kind:** React component · **Lines:** 303 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Input`×5 (components/ui/input.tsx), `Label`×4 (components/ui/label.tsx), `Pencil`×2 (lucide-react), `Button`×2 (components/ui/button.tsx), `Dialog` (components/ui/dialog.tsx), `DialogContent` (components/ui/dialog.tsx), `DialogHeader` (components/ui/dialog.tsx), `DialogTitle` (components/ui/dialog.tsx), `DialogDescription` (components/ui/dialog.tsx), `Textarea` (components/ui/textarea.tsx), `Calendar` (lucide-react), `Clock` (lucide-react), `Checkbox` (components/ui/checkbox.tsx), `Repeat` (lucide-react), `DialogFooter` (components/ui/dialog.tsx), `Loader2` (lucide-react)

### Props

- **`EditEventModal`**: `open: boolean`, `event: CalendarEvent | null`, `onClose: () => void`, `onEventUpdated: () => void`

**Hooks used:** `useState`×8, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `EditEventModal` | component | `EditEventModal({ open, event, onClose, onEventUpdated, }: EditEventModalPr…)` | 37 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `PATCH /backend/events/${event._id}?orgId=${orgId}` (L102)
- **Browser storage / cookies:** `garage_org_id` (localStorage: get)

## Dependencies

- **Internal:**
  - `components/ui/dialog.tsx` — `Dialog`, `DialogContent`, `DialogDescription`, `DialogFooter`, `DialogHeader`, `DialogTitle`
  - `components/ui/button.tsx` — `Button`
  - `components/ui/input.tsx` — `Input`
  - `components/ui/label.tsx` — `Label`
  - `components/ui/textarea.tsx` — `Textarea`
  - `components/ui/checkbox.tsx` — `Checkbox`
  - `lib/api.ts` — `api`
  - `lib/auth.ts` — `getToken`
  - `lib/utils.ts` — `cn`
  - `lib/calendarUtils.ts` — `CalendarEvent`, `(types only)`
- **Packages:**
  - `react` — `useState`, `useEffect`
  - `sonner` — `toast`
  - `lucide-react` — `Calendar`, `Clock`, `Loader2`, `Pencil`, `Repeat`

## Used by

- `components/dashboard/CalendarPage.tsx`
