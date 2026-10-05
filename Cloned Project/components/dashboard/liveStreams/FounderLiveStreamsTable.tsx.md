# `components/dashboard/liveStreams/FounderLiveStreamsTable.tsx`

> Founder console → Live Streams, as a Bigin-style data grid.

**Kind:** React component · **Lines:** 719 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
Founder console → Live Streams, as a Bigin-style data grid.

Replaces the card list. Everything the grid shows comes from one endpoint
(`GET /workshops/founder-table`) which also returns the footer totals for
the WHOLE filtered set and both view counts — so switching One Time ↔
Recurring, drilling into a series, paging and sorting are all one request.

The page owns the data and the filters; `DataTable` owns the grid chrome
(frozen columns, resize/reorder persistence, sticky header, footer).

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Green`×2 (local), `FilterGroup`×2 (local), `Gold` (local), `Red` (local), `SwitchViewPanel` (components/dashboard/liveStreams/SwitchViewPanel.tsx), `LiveStreamOptionsDrawer` (components/dashboard/liveStreams/LiveStreamOptionsDrawer.tsx), `DataTable` (components/data-table/DataTable.tsx), `TopBar` (local), `SlidersHorizontal` (lucide-react), `SeriesHeaderBar` (components/dashboard/liveStreams/SeriesHeaderBar.tsx), `RefreshCw` (lucide-react), `Repeat1` (lucide-react), `ChevronDown` (lucide-react), `SeriesOptionsButton` (components/dashboard/liveStreams/SeriesHeaderBar.tsx)

### Props

- **`FounderLiveStreamsTable`**: `orgId: string | null`, `handlers: LiveStreamOptionsHandlers`, `refreshKey?: number`, `onPanelOpenChange?: (open: boolean) => void`

**Hooks used:** `useState`×22, `useEffect`×5, `useMemo`×4, `useCallback`×2

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `FounderLiveStreamsTableProps` | interface |  | 89 |
| `FounderLiveStreamsTable` | component | `FounderLiveStreamsTable({ orgId, handlers, refreshKey = 0, onPanelOpenChange, }: Fo…)` | 108 |

## Interfaces

- **Timers / queues:** `setTimeout` at L152

## Dependencies

- **Internal:**
  - `components/data-table/DataTable.tsx` — `DataTable`
  - `components/data-table/types.ts` — `SortState`, `(types only)`
  - `lib/feed-api.ts` — `getFounderStreamTable`, `FounderRecurringSeries`, `FounderSeriesHeader`, `FounderStreamRow`, `FounderStreamStatus`, `FounderStreamTotals`, `FounderStreamView`
  - `components/dashboard/liveStreams/founderStreamColumns.tsx` — `buildFounderStreamColumns`
  - `components/dashboard/liveStreams/founderStreamCells.tsx` — `GLASS_STYLE`, `formatUsd`
  - `components/dashboard/liveStreams/SeriesHeaderBar.tsx` — `SeriesHeaderBar`, `SeriesOptionsButton`
  - `components/dashboard/liveStreams/SwitchViewPanel.tsx` — `SwitchViewPanel`
  - `components/dashboard/liveStreams/LiveStreamOptionsDrawer.tsx` — `LiveStreamOptionsDrawer`, `LiveStreamOptionsHandlers`
- **Packages:**
  - `react` — `useCallback`, `useEffect`, `useMemo`, `useState`
  - `lucide-react` — `ChevronDown`, `RefreshCw`, `Repeat1`, `SlidersHorizontal`
  - `sonner` — `toast`

## Used by

- `components/dashboard/WorkshopsPage.tsx`
