# `components/dashboard/calendar/EventCard.tsx`

> React component `EventCard`.

**Kind:** React component · **Lines:** 81 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `MapPin`×2 (lucide-react), `Video` (lucide-react)

### Props

- **`EventCard`**: `event: CalendarEvent`, `style: React.CSSProperties`, `onClick: () => void`, `meId: string`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `EventCard` | component | `EventCard({ event, style, onClick, meId }: EventCardProps)` | 15 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/calendarUtils.ts` — `formatTime`, `categorizeEvent`, `eventColors`
  - `lib/calendarUtils.ts` — `CalendarEvent`, `(types only)`
  - `lib/utils.ts` — `cn`
- **Packages:**
  - `lucide-react` — `Video`, `MapPin`

## Used by

- `components/dashboard/calendar/CalendarGrid.tsx`
