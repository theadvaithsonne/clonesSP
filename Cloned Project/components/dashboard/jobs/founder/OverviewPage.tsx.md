# `components/dashboard/jobs/founder/OverviewPage.tsx`

> A1 · Jobs overview — live KPIs, the hiring funnel, where applicants come from, what needs attention, and the live roles.

**Kind:** React component · **Lines:** 322 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
A1 · Jobs overview — live KPIs, the hiring funnel, where applicants come
from, what needs attention, and the live roles.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `StatTile`×5 (components/dashboard/jobs/ui.tsx), `Card`×5 (components/dashboard/jobs/ui.tsx), `Button`×2 (components/dashboard/jobs/ui.tsx), `Plus`×2 (lucide-react), `CalendarClock`×2 (lucide-react), `ChevronRight`×2 (lucide-react), `PageHeader` (components/dashboard/jobs/ui.tsx), `LoadingBlock` (components/dashboard/jobs/ui.tsx), `ErrorState` (components/dashboard/jobs/ui.tsx), `OverviewBody` (local), `EmptyState` (components/dashboard/jobs/ui.tsx), `Briefcase` (lucide-react), `FilterMenu` (components/dashboard/jobs/ui.tsx), `ResponsiveContainer` (recharts), `PieChart` (recharts), `Pie` (recharts), `Cell` (recharts), `AlertCircle` (lucide-react), `LiveJobRow` (local), `StatusPill` (components/dashboard/jobs/ui.tsx), `RewardBadge` (components/dashboard/jobs/ui.tsx)

**Hooks used:** `useJobsNav` (components/dashboard/jobs/nav.tsx), `useJobsNavStore` (components/dashboard/jobs/nav.tsx), `useLoad` (components/dashboard/jobs/ui.tsx)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (OverviewPage)` | component | `OverviewPage()` | 30 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/dashboard/jobs/api.ts` — `* as jobsApi`
  - `components/dashboard/jobs/constants.ts` — `CATEGORY_META`, `JOB_PAGES`, `SOURCE_COLORS`, `SOURCE_LABELS`, `WORKPLACE_LABELS`
  - `components/dashboard/jobs/nav.tsx` — `useJobsNav`, `useJobsNavStore`
  - `components/dashboard/jobs/ui.tsx` — `Button`, `Card`, `EmptyState`, `ErrorState`, `FilterMenu`, `GOLD`, `LoadingBlock`, `PageHeader`, … +6
  - `components/dashboard/jobs/types.ts` — `OverviewResponse`, `PostingRow`, `(types only)`
- **Packages:**
  - `react`
  - `lucide-react` — `AlertCircle`, `CalendarClock`, `ChevronRight`, `Plus`, `Briefcase`
  - `recharts` — `PieChart`, `Pie`, `Cell`, `ResponsiveContainer`

## Used by

- `components/dashboard/jobs/founder/FounderJobsApp.tsx`
