# `components/dashboard/liveStreams/LiveStreamOptionsDrawer.tsx`

> Per-row action drawer for the founder Live Streams grid.

**Kind:** React component · **Lines:** 575 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
Per-row action drawer for the founder Live Streams grid.

Everything a founder can do to one stream, in one place, so the table's
cells stay pure data. The drawer is callback-driven — it owns presentation
and its own sub-panels (Links, Email Reminders, WhatsApp Reminders) and
hands the rest back to the page, which already holds the modals and the
mutations.

Start is deliberately conditional: it renders only while the stream's
backend status is `not_started`. Offering "Start" on a row the table itself
labels Active or Completed is the contradiction most likely to cost a
founder a live session. An `active` row gets Join instead — the way back
into a stream that is still live after the host's tab or browser closed.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `DrawerShell` (components/dashboard/liveStreams/DrawerShell.tsx), `DrawerListSkeleton` (components/dashboard/liveStreams/DrawerShell.tsx), `DrawerCard` (components/dashboard/liveStreams/DrawerShell.tsx), `OptionIcon` (local), `ChevronRight` (lucide-react), `LinksPanel` (local), `RemindersPanel` (local), `CopyButton` (local), `Check` (lucide-react), `Copy` (lucide-react)

### Props

- **`LiveStreamOptionsDrawer`**: `row: FounderStreamRow | null`, `onClose: () => void`, `handlers: LiveStreamOptionsHandlers`, `loading?: boolean`

**Hooks used:** `useState`×6, `useEffect`×2, `useMemo`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `LiveStreamOptionsHandlers` | interface |  | 25 |
| `LiveStreamOptionsDrawer` | component | `LiveStreamOptionsDrawer({ row, onClose, handlers, loading, }: { /** The row whose o…)` | 117 |

## Interfaces

- **Timers / queues:** `setTimeout` at L428

## Dependencies

- **Internal:**
  - `lib/feed-api.ts` — `FounderStreamRow`, `(types only)`
  - `components/dashboard/liveStreams/DrawerShell.tsx` — `DrawerCard`, `DrawerListSkeleton`, `DrawerShell`
- **Packages:**
  - `react` — `useEffect`, `useMemo`, `useState`
  - `lucide-react` — `Check`, `ChevronRight`, `Copy`
  - `sonner` — `toast`

## Used by

- `components/dashboard/liveStreams/FounderLiveStreamsTable.tsx`
