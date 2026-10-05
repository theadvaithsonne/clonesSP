# `components/dashboard/liveStreams/SwitchViewPanel.tsx`

> The founder console's view switcher — a two-step docked panel.

**Kind:** React component · **Lines:** 209 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The founder console's view switcher — a two-step docked panel.

Step 1 "Switch View"            → One Time (n) / Recurring (n)
Step 2 "Recurring Live Streams" → pick WHICH series' sessions to table

Recurring needs the second step because the two views answer different
questions: One Time lists streams, Recurring lists the SESSIONS of one
series. Without the picker there would be nothing to say which series the
session rows belong to.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `DrawerCard`×2 (components/dashboard/liveStreams/DrawerShell.tsx), `ViewRow`×2 (local), `SelectedDot`×2 (local), `ChevronRight`×2 (lucide-react), `DrawerShell` (components/dashboard/liveStreams/DrawerShell.tsx), `DrawerListSkeleton` (components/dashboard/liveStreams/DrawerShell.tsx), `SeriesPickerSkeleton` (components/dashboard/liveStreams/DrawerShell.tsx), `Repeat1` (lucide-react), `RefreshCw` (lucide-react), `Avatar` (components/dashboard/liveStreams/founderStreamCells.tsx), `Check` (lucide-react)

### Props

- **`SwitchViewPanel`**: `open: boolean`, `onClose: () => void`, `view: FounderStreamView`, `counts: { oneTime: number; recurring: number }`, `series: FounderRecurringSeries[]`, `selectedSeriesId: string | null`, `loading?: boolean`, `onPick: (view: FounderStreamView, seriesId?: string) => void`

**Hooks used:** `useState`×3, `useEffect`, `useMemo`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `SwitchViewPanel` | component | `SwitchViewPanel({ open, onClose, view, counts, series, selectedSeriesId, lo…)` | 26 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/feed-api.ts` — `FounderRecurringSeries`, `FounderStreamView`, `(types only)`
  - `components/dashboard/liveStreams/founderStreamCells.tsx` — `Avatar`
  - `components/dashboard/liveStreams/DrawerShell.tsx` — `DrawerCard`, `DrawerListSkeleton`, `DrawerShell`, `SeriesPickerSkeleton`
- **Packages:**
  - `react` — `useEffect`, `useMemo`, `useState`
  - `lucide-react` — `Check`, `ChevronRight`, `RefreshCw`, `Repeat1`

## Used by

- `components/dashboard/liveStreams/FounderLiveStreamsTable.tsx`
