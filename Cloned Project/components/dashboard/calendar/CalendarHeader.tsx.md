# `components/dashboard/calendar/CalendarHeader.tsx`

> React component `CalendarHeader`.

**Kind:** React component · **Lines:** 127 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Button`×4 (components/ui/button.tsx), `SelectItem`×3 (components/ui/select.tsx), `ChevronLeft` (lucide-react), `Calendar` (lucide-react), `ChevronRight` (lucide-react), `Plus` (lucide-react), `Select` (components/ui/select.tsx), `SelectTrigger` (components/ui/select.tsx), `SelectValue` (components/ui/select.tsx), `SelectContent` (components/ui/select.tsx)

### Props

- **`CalendarHeader`**: `currentDate: Date`, `viewMode: ViewMode`, `onDateChange: (date: Date) => void`, `onViewChange: (mode: ViewMode) => void`, `onToday: () => void`, `onCreateEvent?: () => void`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `CalendarHeader` | component | `CalendarHeader({ currentDate, viewMode, onDateChange, onViewChange, onToda…)` | 24 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/ui/button.tsx` — `Button`
  - `components/ui/select.tsx` — `Select`, `SelectContent`, `SelectItem`, `SelectTrigger`, `SelectValue`
  - `lib/calendarUtils.ts` — `getMonthYear`
  - `lib/calendarUtils.ts` — `ViewMode`, `(types only)`
- **Packages:**
  - `lucide-react` — `ChevronLeft`, `ChevronRight`, `Calendar`, `Plus`

## Used by

- `components/dashboard/CalendarPage.tsx`
