# `components/dashboard/founderGrid/unsubLog/unsubLogColumns.tsx`

> The columns of the founder Unsub Log grid.

**Kind:** React component · **Lines:** 174 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The columns of the founder Unsub Log grid.

The parent pins one item kind per page (Communities / Live Streams /
Courses), so there is no Kind column — every row on a given page is the
same kind and the column would repeat one label down the whole table. The
item column's header comes from that same pinned label.

NO SELECTION COLUMN and NO `sortable` FLAGS, for the same reasons as the
Orders grid: the log is read-only with no per-row action, and
`/feed/founder/unsub-log` sorts `occurredAt: -1` with no sort parameter —
a control here could only reorder the rows already in the browser.

Ids are the localStorage key for each column's saved width/order, so
renaming one resets every founder's layout.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Bar`×8 (components/dashboard/founderGrid/unsubLog/unsubLogCells.tsx), `StackSkeleton`×2 (local), `PersonSkeleton` (local), `MemberCell` (components/dashboard/founderGrid/unsubLog/unsubLogCells.tsx), `ItemCell` (components/dashboard/founderGrid/unsubLog/unsubLogCells.tsx), `PillSkeleton` (local), `EventBadge` (components/dashboard/founderGrid/unsubLog/unsubLogCells.tsx), `PeriodCell` (components/dashboard/founderGrid/unsubLog/unsubLogCells.tsx), `WhenCell` (components/dashboard/founderGrid/unsubLog/unsubLogCells.tsx), `SessionCell` (components/dashboard/founderGrid/unsubLog/unsubLogCells.tsx), `AccessWindowCell` (components/dashboard/founderGrid/unsubLog/unsubLogCells.tsx), `LtvCell` (components/dashboard/founderGrid/unsubLog/unsubLogCells.tsx)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `buildUnsubLogColumns` | function | `buildUnsubLogColumns({ itemLabel, showSession, }: { /** Singular name of the thi…): ColumnDef<FounderUnsubLogRow>[]` | 74 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/data-table/types.ts` — `ColumnDef`, `(types only)`
  - `lib/feed-api.ts` — `FounderUnsubLogRow`, `(types only)`
  - `components/dashboard/founderGrid/unsubLog/unsubLogCells.tsx` — `AccessWindowCell`, `Bar`, `EventBadge`, `ItemCell`, `LtvCell`, `MemberCell`, `PeriodCell`, `SessionCell`, … +1
- **Packages:** none

## Used by

- `components/dashboard/founderGrid/unsubLog/UnsubLogTable.tsx`
