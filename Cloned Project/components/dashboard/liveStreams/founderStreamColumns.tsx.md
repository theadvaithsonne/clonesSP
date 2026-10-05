# `components/dashboard/liveStreams/founderStreamColumns.tsx`

> The columns of the founder Live Streams grid.

**Kind:** React component · **Lines:** 541 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The columns of the founder Live Streams grid.

THREE COLUMN SETS, ONE ROW TYPE
  One Time              every column — each row is a different stream, so
                        name, communities and price all differ per row.
  Recurring · per       the sessions of one series, each bought separately:
  session               drop name/communities (identical on every row, and
                        printed once in the header above the table), keep
                        Payment and the enrolment columns, since a session
                        is its own sale.
  Recurring · one time  same, minus every enrolment column. The series is
  enrollment            bought once, so its price, enrolments, revenue and
                        affiliate split are series facts and live in the
                        header. Repeating one series-wide figure down 45
                        rows reads as 45 separate sales.
 […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Bar`×8 (local), `Stack`×8 (components/dashboard/liveStreams/founderStreamCells.tsx), `StackSkeleton`×7 (local), `MetricSkeleton`×3 (local), `StreamThumb` (components/dashboard/liveStreams/founderStreamCells.tsx), `Avatar` (components/dashboard/liveStreams/founderStreamCells.tsx), `CommunitiesCell` (components/dashboard/liveStreams/founderStreamCells.tsx), `StatusBadge` (components/dashboard/liveStreams/founderStreamCells.tsx)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `FounderColumnVariant` | type | Which table is being built. | 83 |
| `buildFounderStreamColumns` | function | `buildFounderStreamColumns(variant: FounderColumnVariant = { view: "one-time" }): ColumnDef<FounderStreamRow>[]` | 87 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/data-table/types.ts` — `ColumnDef`, `(types only)`
  - `lib/feed-api.ts` — `FounderStreamRow`, `(types only)`
  - `lib/country-flag.ts` — `getCountryFlag`
  - `components/dashboard/liveStreams/founderStreamCells.tsx` — `Avatar`, `CommunitiesCell`, `Stack`, `StatusBadge`, `StreamThumb`, `currencyFlag`, `formatClock`, `formatDuration`, … +5
- **Packages:** none

## Used by

- `components/dashboard/liveStreams/FounderLiveStreamsTable.tsx`
