# `components/dashboard/calendar/FollowUpGroupCard.tsx`

> React component `FollowUpGroupCard`.

**Kind:** React component · **Lines:** 113 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Popover` (components/ui/popover.tsx), `PopoverTrigger` (components/ui/popover.tsx), `PopoverContent` (components/ui/popover.tsx), `MapPin` (lucide-react)

### Props

- **`FollowUpGroupCard`**: `events: CalendarEvent[]`, `style: React.CSSProperties`, `onSelectEvent: (event: CalendarEvent) => void`

**Hooks used:** `useState`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `FollowUpGroupCard` | component | `FollowUpGroupCard({ events, style, onSelectEvent, }: FollowUpGroupCardProps)` | 20 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/calendarUtils.ts` — `formatTime`, `eventColors`
  - `lib/calendarUtils.ts` — `CalendarEvent`, `(types only)`
  - `lib/utils.ts` — `cn`
  - `components/ui/popover.tsx` — `Popover`, `PopoverContent`, `PopoverTrigger`
- **Packages:**
  - `react` — `useState`
  - `lucide-react` — `MapPin`

## Used by

- `components/dashboard/calendar/CalendarGrid.tsx`
