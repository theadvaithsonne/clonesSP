# `components/dashboard/liveStreams/SessionScheduleEditor.tsx`

> The live sessions a recurrence rule produces, listed and individually editable, inside the live-stream create/edit form.

**Kind:** React component · **Lines:** 541 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The live sessions a recurrence rule produces, listed and individually
editable, inside the live-stream create/edit form.

Sessions of a series are computed, never stored — so this list is derived
from whatever the form currently says (see `lib/recurrence.ts`), and it
updates as the founder changes the pattern. Editing one writes a
per-session override through the existing
`PUT /workshops/:id/sessions/:sessionDate` endpoint; nothing new is
persisted by this component itself.

Two modes, one UI:

  EDITING an existing stream — a save goes to the backend immediately, and
  sessions already customised are loaded up front so the list shows what
  each session really says.
 […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Shell`×3 (local), `TimeSelector`×2 (components/dashboard/TimeSelector.tsx), `Loader2`×2 (lucide-react), `X` (lucide-react), `Pencil` (lucide-react), `Check` (lucide-react), `RotateCcw` (lucide-react), `CalendarDays` (lucide-react)

### Props

- **`SessionScheduleEditor`**: `pattern: ClientRecurrencePattern`, `startDate: string`, `endDate: string`, `seriesTitle: string`, `seriesDescription?: string`, `startTime: string`, `endTime: string`, `workshopId: string | null`, `drafts: SessionDraftMap`, `onDraftsChange: (next: SessionDraftMap) => void`, `onSaveSession?: (ymd: string, draft: SessionDraft) => Promise<boolean>`

**Hooks used:** `useState`×6, `useMemo`, `useEffect`, `useCallback`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `SessionDraft` | interface | What a founder may change on one session from this panel. | 43 |
| `SessionDraftMap` | type |  | 52 |
| `isDraftEmpty` | function | `isDraftEmpty(draft: SessionDraft \| undefined): boolean` — Is anything actually set on this draft? | 55 |
| `SessionScheduleEditorProps` | interface |  | 90 |
| `SessionScheduleEditor` | component | `SessionScheduleEditor({ pattern, startDate, endDate, seriesTitle, seriesDescripti…)` | 112 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/recurrence.ts` — `computeSessionDays`, `describePattern`, `ymdToUtcDate`, `ClientRecurrencePattern`
  - `lib/feed-api.ts` — `getWorkshopSessions`, `WorkshopSession`
  - `components/dashboard/TimeSelector.tsx` — `TimeSelector`
  - `lib/utils.ts` — `cn`
- **Packages:**
  - `react` — `useCallback`, `useEffect`, `useMemo`, `useState`
  - `lucide-react` — `CalendarDays`, `Check`, `Loader2`, `Pencil`, `RotateCcw`, `X`

## Used by

- `components/dashboard/WorkshopsPage.tsx`
