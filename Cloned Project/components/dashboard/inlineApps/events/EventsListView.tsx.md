# `components/dashboard/inlineApps/events/EventsListView.tsx`

> React component `EventsListView`.

**Kind:** React component · **Lines:** 215 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Button`×2 (components/dashboard/inlineApps/events/ui.tsx), `Plus`×2 (lucide-react), `CalendarDays`×2 (lucide-react), `Search` (lucide-react), `Loader2` (lucide-react), `EmptyState` (components/dashboard/inlineApps/events/ui.tsx), `Card` (components/dashboard/inlineApps/events/ui.tsx), `Globe` (lucide-react), `MapPin` (lucide-react), `Ticket` (lucide-react), `Users` (lucide-react)

### Props

- **`EventsListView`**: `onCreate: () => void`, `onOpen: (id: string) => void`

**Hooks used:** `useState`×4, `useCallback`, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (EventsListView)` | component | `EventsListView({ onCreate, onOpen, }: { onCreate: () => void; onOpen: (id:…)` | 34 |

## Interfaces

- **Timers / queues:** `setTimeout` at L60

## Dependencies

- **Internal:**
  - `components/dashboard/inlineApps/events/ui.tsx` — `Button`, `Card`, `EmptyState`, `GOLD`
  - `components/dashboard/inlineApps/events/api.ts` — `listEvents`
  - `components/dashboard/inlineApps/events/types.ts` — `EventProgram`, `EventStatus`, `(types only)`
- **Packages:**
  - `react` — `useCallback`, `useEffect`, `useState`
  - `lucide-react` — `CalendarDays`, `MapPin`, `Plus`, `Search`, `Ticket`, `Users`, …
  - `sonner` — `toast`

## Used by

- `components/dashboard/inlineApps/events/EventsApp.tsx`
