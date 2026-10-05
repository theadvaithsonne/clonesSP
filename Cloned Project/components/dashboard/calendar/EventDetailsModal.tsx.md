# `components/dashboard/calendar/EventDetailsModal.tsx`

> React component `EventDetailsModal`.

**Kind:** React component · **Lines:** 489 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Button`×10 (components/ui/button.tsx), `User`×3 (lucide-react), `Mail`×2 (lucide-react), `Video`×2 (lucide-react), `AlertTriangle`×2 (lucide-react), `Trash2`×2 (lucide-react), `X`×2 (lucide-react), `Dialog` (components/ui/dialog.tsx), `DialogContent` (components/ui/dialog.tsx), `DialogHeader` (components/ui/dialog.tsx), `DialogTitle` (components/ui/dialog.tsx), `Repeat` (lucide-react), `Calendar` (lucide-react), `Clock` (lucide-react), `Users` (lucide-react), `Copy` (lucide-react), `MapPin` (lucide-react), `AnimatePresence` (framer-motion), `Pencil` (lucide-react), `UserCog` (lucide-react)

### Props

- **`EventDetailsModal`**: `open: boolean`, `event: CalendarEvent | null`, `meId: string`, `currentTime: Date`, `onClose: () => void`, `onCancel: (bookingId: string) => void`, `onEdit?: (event: CalendarEvent) => void`, `onDelete?: (eventId: string) => void`, `onEditMembers?: (event: CalendarEvent) => void`

**Hooks used:** `useState`×2, `useRouter` (next/navigation)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `EventDetailsModal` | component | `EventDetailsModal({ open, event, meId, currentTime, onClose, onCancel, onEdit…)` | 26 |

## Interfaces

- **Browser storage / cookies:** `deals` (sessionStorage: inline-pending-lead-id)

## Dependencies

- **Internal:**
  - `components/ui/dialog.tsx` — `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`
  - `components/ui/button.tsx` — `Button`
  - `lib/calendarUtils.ts` — `categorizeEvent`, `eventColors`, `formatFullDate`, `formatTime`
  - `lib/calendarUtils.ts` — `CalendarEvent`, `(types only)`
  - `lib/utils.ts` — `cn`
- **Packages:**
  - `react` — `useState`
  - `lucide-react` — `Calendar`, `Clock`, `User`, `Video`, `MapPin`, `X`, …
  - `sonner` — `toast`
  - `next` — `useRouter`
  - `framer-motion` — `motion`, `AnimatePresence`

## Used by

- `components/dashboard/CalendarPage.tsx`
