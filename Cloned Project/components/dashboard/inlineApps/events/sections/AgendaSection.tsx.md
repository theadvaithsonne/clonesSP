# `components/dashboard/inlineApps/events/sections/AgendaSection.tsx`

> The agenda is a schedule grid, not a list.

**Kind:** React component · **Lines:** 1326 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The agenda is a schedule grid, not a list.

A conference runs several tracks at once, so the question an organizer is
actually asking is "what is happening at 11:00, and where are the holes?" —
which a flat chronological list can't answer. Columns are tracks, rows are
time boundaries, and an empty cell is a click target that creates a session
already pinned to that track and slot.

Rows are the sorted set of every start and end time on the day rather than a
fixed hourly ruler. That is why a 10:45 coffee break gets its own row: the
grid follows the schedule instead of forcing the schedule into hour blocks.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `CustomSelect`×9 (components/dashboard/inlineApps/events/ui.tsx), `Toggle`×5 (components/dashboard/inlineApps/events/ui.tsx), `Button`×3 (components/dashboard/inlineApps/events/ui.tsx), `Plus`×2 (lucide-react), `TextInput`×2 (components/dashboard/inlineApps/events/ui.tsx), `ComboSelect`×2 (local), `Label`×2 (components/dashboard/inlineApps/events/ui.tsx), `Loader2` (lucide-react), `EmptyState` (components/dashboard/inlineApps/events/ui.tsx), `CalendarClock` (lucide-react), `Coffee` (lucide-react), `Radio` (lucide-react), `Trash2` (lucide-react), `Modal` (components/dashboard/inlineApps/events/ui.tsx), `TextArea` (components/dashboard/inlineApps/events/ui.tsx), `X` (lucide-react)

### Props

- **`AgendaSection`**: `eventId: string`, `eventName?: string`, `event?: EventProgram | null`

**Hooks used:** `useState`×12, `useMemo`×11, `useCallback`×4, `useEffect`×2, `useConfirm` (components/dashboard/inlineApps/events/ui.tsx), `useConsoleAction` (components/dashboard/inlineApps/events/ui.tsx)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `TRACK_COLORS` | const | `= [ "#FBD10D", "#60a5fa", "#a78bfa", "#34d399", "#f472b6", "#fb923c", ]` — Track dot colours, assigned by column order when a track sets none. | 168 |
| `default (AgendaSection)` | component | `AgendaSection({ eventId, eventName, event, }: { eventId: string; eventNam…)` | 232 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/dashboard/inlineApps/events/ui.tsx` — `Button`, `CustomSelect`, `EmptyState`, `GOLD`, `Label`, `Modal`, `TextArea`, `TextInput`, … +5
  - `components/dashboard/inlineApps/events/api.ts` — `createSession`, `deleteSession`, `listSessions`, `listSpeakers`, `updateSession`
  - `components/dashboard/inlineApps/events/types.ts` — `AgendaSession`, `EventProgram`, `EventSpeaker`, `(types only)`
- **Packages:**
  - `react` — `useCallback`, `useEffect`, `useMemo`, `useState`
  - `lucide-react` — `CalendarClock`, `Coffee`, `Loader2`, `Plus`, `Radio`, `Trash2`, …
  - `sonner` — `toast`

## Used by

- `components/dashboard/inlineApps/events/EventConsole.tsx`
- `components/dashboard/inlineApps/events/EventDetailView.tsx`
