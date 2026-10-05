# `components/dashboard/jobs/founder/workspace/AnalyticsTab.tsx`

> A17 · Job analytics — views and applications over time, where candidates drop out of the application form, which sources bring applicants and hires, and the affiliates referring the most people.

**Kind:** React component · **Lines:** 267 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
A17 · Job analytics — views and applications over time, where candidates
drop out of the application form, which sources bring applicants and hires,
and the affiliates referring the most people. Renders inside the job
workspace, which provides the page padding and scroll container.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `StatTile`×6 (components/dashboard/jobs/ui.tsx), `Card`×4 (components/dashboard/jobs/ui.tsx), `Area`×2 (recharts), `LoadingBlock` (components/dashboard/jobs/ui.tsx), `ErrorState` (components/dashboard/jobs/ui.tsx), `KpiTiles` (local), `Loader2` (lucide-react), `Chip` (components/dashboard/jobs/ui.tsx), `ViewsChart` (local), `DropoffCard` (local), `SourcesCard` (local), `ReferrersCard` (local), `ResponsiveContainer` (recharts), `AreaChart` (recharts), `CartesianGrid` (recharts), `XAxis` (recharts), `YAxis` (recharts), `Tooltip` (recharts), `TrendingDown` (lucide-react), `Avatar` (components/dashboard/jobs/ui.tsx)

### Props

- **`AnalyticsTab`**: `jobId: string`

**Hooks used:** `useLoad` (components/dashboard/jobs/ui.tsx)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (AnalyticsTab)` | component | `AnalyticsTab({ jobId }: { jobId: string })` | 26 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/dashboard/jobs/api.ts` — `* as jobsApi`
  - `components/dashboard/jobs/constants.ts` — `SOURCE_COLORS`, `SOURCE_LABELS`
  - `components/dashboard/jobs/ui.tsx` — `Avatar`, `Card`, `Chip`, `ErrorState`, `GOLD`, `LoadingBlock`, `StatTile`, `formatMoney`, … +1
  - `components/dashboard/jobs/types.ts` — `AnalyticsResponse`, `(types only)`
- **Packages:**
  - `react`
  - `lucide-react` — `Loader2`, `TrendingDown`
  - `recharts` — `Area`, `AreaChart`, `CartesianGrid`, `ResponsiveContainer`, `Tooltip`, `XAxis`, …

## Used by

- `components/dashboard/jobs/founder/workspace/JobWorkspace.tsx`
