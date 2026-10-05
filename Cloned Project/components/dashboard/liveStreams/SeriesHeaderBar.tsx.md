# `components/dashboard/liveStreams/SeriesHeaderBar.tsx`

> The chip row above the recurring table.

**Kind:** React component · **Lines:** 212 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The chip row above the recurring table.

Every row below it is a session of ONE series, so the facts that don't vary
session to session belong here rather than in a column that would repeat the
same value 45 times: which series, its status, the communities it went to
and — for an enrol-once series — the price and the affiliate split, since
those are bought once for the whole series rather than per session.

A per-session series deliberately does NOT get the price chip: each session
is its own sale, so the price can differ row to row and stays in the table.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Avatar`×2 (components/dashboard/liveStreams/founderStreamCells.tsx), `ChevronDown`×2 (lucide-react), `StatusIcon` (local), `CommunitiesChip` (local), `MoreHorizontal` (lucide-react)

### Props

- **`SeriesHeaderBar`**: `header: FounderSeriesHeader`, `onOpenSwitch: () => void`
- **`SeriesOptionsButton`**: `onClick: () => void`

**Hooks used:** `useState`×2, `useRef`, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `SeriesHeaderBar` | component | `SeriesHeaderBar({ header, onOpenSwitch, }: { header: FounderSeriesHeader; /…)` | 26 |
| `SeriesOptionsButton` | component | `SeriesOptionsButton({ onClick }: { onClick: () => void })` — "Series Level Options" — the drawer for the series itself, as opposed to a row's tick, which opens the drawer for one session. | 111 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/feed-api.ts` — `FounderSeriesHeader`, `(types only)`
  - `components/dashboard/liveStreams/founderStreamCells.tsx` — `Avatar`, `currencyFlag`, `formatPrice`, `statusMeta`
- **Packages:**
  - `react` — `useEffect`, `useRef`, `useState`
  - `react-dom` — `createPortal`
  - `lucide-react` — `ChevronDown`, `MoreHorizontal`

## Used by

- `components/dashboard/liveStreams/FounderLiveStreamsTable.tsx`
