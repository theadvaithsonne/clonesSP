# `components/dashboard/founderGrid/unsubLog/unsubLogCells.tsx`

> Cell renderers + formatters for the founder Unsub Log grid.

**Kind:** React component · **Lines:** 251 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
Cell renderers + formatters for the founder Unsub Log grid.

Split out of the column definitions so the table and the footer strip
format the same event the same way.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `DollarSign`×2 (lucide-react), `Calendar`×2 (lucide-react), `Clock`×2 (lucide-react), `UserIcon` (lucide-react), `Building2` (lucide-react), `Repeat` (lucide-react), `ArrowRight` (lucide-react)

### Props

- **`MemberCell`**: `row: FounderUnsubLogRow`
- **`ItemCell`**: `title: string | null`
- **`EventBadge`**: `row: FounderUnsubLogRow`
- **`PeriodCell`**: `row: FounderUnsubLogRow`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `formatDate` | function | `formatDate(iso: string \| Date \| null \| undefined): string` | 24 |
| `relativeDay` | function | `relativeDay(iso: string \| null \| undefined): string \| null` — "Today" / "Yesterday" / "12d ago" — the second line of the When cell. | 37 |
| `formatLtv` | function | `formatLtv(amount: number): string` — Lifetime value. | 55 |
| `MemberCell` | component | `MemberCell({ row }: { row: FounderUnsubLogRow })` — The person who left. Name falls back to email, then "Unknown" — a blank first column would make the row look like a loading artefact. | 66 |
| `ItemCell` | component | `ItemCell({ title }: { title: string \| null })` — What they left — the community or the live stream. | 91 |
| `EventBadge` | component | `EventBadge({ row }: { row: FounderUnsubLogRow })` — Cancelled vs Expired. | 108 |
| `PeriodCell` | component | `PeriodCell({ row }: { row: FounderUnsubLogRow })` — What they were paying — recurring period, one-time, or free. | 124 |
| `WhenCell` | component | `WhenCell({ row }: { row: FounderUnsubLogRow })` | 146 |
| `SessionCell` | component | `SessionCell({ row }: { row: FounderUnsubLogRow })` — Populated only for per-session workshop cancels — which session in the recurrence they walked away from. | 163 |
| `AccessWindowCell` | component | `AccessWindowCell({ row }: { row: FounderUnsubLogRow })` — How much of what they paid for they actually used. | 182 |
| `LtvCell` | component | `LtvCell({ row }: { row: FounderUnsubLogRow })` | 219 |
| `Bar` | component | `Bar({ w, h = "h-3.5", dim, rounded = "rounded", }: { w: string;…)` — One shimmer bar. `w` is a Tailwind width class so the skeleton can echo the rough length of the text it stands in for. | 232 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/feed-api.ts` — `FounderUnsubLogRow`, `(types only)`
  - `components/dashboard/founderGrid/tokens.ts` — `GLASS_STYLE`
- **Packages:**
  - `lucide-react` — `ArrowRight`, `Building2`, `Calendar`, `Clock`, `DollarSign`, `Repeat`, …

## Used by

- `components/dashboard/founderGrid/unsubLog/UnsubLogTable.tsx`
- `components/dashboard/founderGrid/unsubLog/unsubLogColumns.tsx`
