# `components/dashboard/inlineApps/events/EventPickerModal.tsx`

> "Which event?"

**Kind:** React component · **Lines:** 147 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
"Which event?"

Every PLAN / SELL / REACH page is a page *of an event*, so landing on one
with nothing open used to mean the sidebar item was simply dead — greyed out
with an "Open an event first" tooltip and no way to act on it. This asks the
question instead: pick an event and you land on the page you actually
clicked. It doubles as the switcher for jumping between events without going
back to the catalogue.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Modal` (components/dashboard/inlineApps/events/ui.tsx), `Search` (lucide-react), `Loader2` (lucide-react), `CalendarDays` (lucide-react)

### Props

- **`EventPickerModal`**: `open: boolean`, `onClose: () => void`, `onSelect: (eventId: string) => void`, `currentEventId?: string`, `destinationLabel?: string`

**Hooks used:** `useState`×3, `useCallback`, `useEffect`, `useMemo`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (EventPickerModal)` | component | `EventPickerModal({ open, onClose, onSelect, currentEventId, /** The page the…)` | 18 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/dashboard/inlineApps/events/ui.tsx` — `GOLD`, `Modal`
  - `components/dashboard/inlineApps/events/api.ts` — `listEvents`
  - `components/dashboard/inlineApps/events/types.ts` — `EventProgram`, `(types only)`
- **Packages:**
  - `react` — `useCallback`, `useEffect`, `useMemo`, `useState`
  - `lucide-react` — `CalendarDays`, `Loader2`, `Search`

## Used by

- `components/dashboard/inlineApps/events/EventsApp.tsx`
