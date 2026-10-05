# `components/dashboard/CoworkingSpacesPage.tsx`

> React component `CoworkingSpacesPage`.

**Kind:** React component · **Lines:** 994 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Button`×9 (components/ui/button.tsx), `CalendarIcon`×6 (lucide-react), `Badge`×5 (components/ui/badge.tsx), `Landmark`×4 (lucide-react), `MapPin`×3 (lucide-react), `Users`×3 (lucide-react), `Label`×3 (components/ui/label.tsx), `X`×2 (lucide-react), `Star`×2 (lucide-react), `ChevronLeft`×2 (lucide-react), `ChevronRight`×2 (lucide-react), `SelectItem`×2 (components/ui/select.tsx), `Popover`×2 (components/ui/popover.tsx), `PopoverTrigger`×2 (components/ui/popover.tsx), `PopoverContent`×2 (components/ui/popover.tsx), `Calendar`×2 (components/ui/calendar.tsx), `TabsTrigger`×2 (components/ui/tabs.tsx), `TabsContent`×2 (components/ui/tabs.tsx), `Clock` (lucide-react), `CheckCircle2` (lucide-react), `XCircle` (lucide-react), `AlertCircle` (lucide-react), `ArrowLeft` (lucide-react), `Dialog` (components/ui/dialog.tsx), `DialogContent` (components/ui/dialog.tsx), `DialogHeader` (components/ui/dialog.tsx), `DialogTitle` (components/ui/dialog.tsx), `Select` (components/ui/select.tsx), `SelectTrigger` (components/ui/select.tsx), `SelectValue` (components/ui/select.tsx), `SelectContent` (components/ui/select.tsx), `Input` (components/ui/input.tsx), `DialogFooter` (components/ui/dialog.tsx), `Loader2` (lucide-react), `AnimatePresence` (framer-motion), `Tabs` (components/ui/tabs.tsx), `TabsList` (components/ui/tabs.tsx)

**Hooks used:** `useState`×15, `useEffect`×2

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (CoworkingSpacesPage)` | component | `CoworkingSpacesPage()` | 97 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/garage-admin/coworking-spaces/public` (L128)
  - `GET /backend/coworking-bookings/my-bookings` (L145)
  - `POST /backend/coworking-bookings/request` (L248)
  - `PATCH /backend/coworking-bookings/${bookingId}/cancel` (L281)

## Dependencies

- **Internal:**
  - `lib/api.ts` — `api`
  - `lib/auth.ts` — `getToken`
  - `components/ui/badge.tsx` — `Badge`
  - `components/ui/button.tsx` — `Button`
  - `components/ui/tabs.tsx` — `Tabs`, `TabsContent`, `TabsList`, `TabsTrigger`
  - `components/ui/dialog.tsx` — `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogFooter`
  - `components/ui/input.tsx` — `Input`
  - `components/ui/label.tsx` — `Label`
  - `components/ui/select.tsx` — `Select`, `SelectContent`, `SelectItem`, `SelectTrigger`, `SelectValue`
  - `components/ui/calendar.tsx` — `Calendar`
  - `components/ui/popover.tsx` — `Popover`, `PopoverContent`, `PopoverTrigger`
- **Packages:**
  - `react` — `useState`, `useEffect`
  - `lucide-react` — `Landmark`, `MapPin`, `Star`, `X`, `ChevronLeft`, `ChevronRight`, …
  - `sonner` — `toast`
  - `framer-motion` — `AnimatePresence`, `motion`
  - `date-fns` — `format`, `addDays`, `differenceInDays`
  - `react-day-picker` — `DateRange`

## Used by

- `app/(dashboard)/layout.tsx`
