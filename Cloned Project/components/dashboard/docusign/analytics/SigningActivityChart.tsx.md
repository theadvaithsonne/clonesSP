# `components/dashboard/docusign/analytics/SigningActivityChart.tsx`

> React component `SigningActivityChart`.

**Kind:** React component · **Lines:** 89 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Bar`×2 (recharts), `ResponsiveContainer` (recharts), `BarChart` (recharts), `CartesianGrid` (recharts), `XAxis` (recharts), `YAxis` (recharts), `Tooltip` (recharts)

### Props

- **`SigningActivityChart`**: `activity: DsAnalyticsSummary["signingActivity"] | null`, `loading?: boolean`

**Hooks used:** `useMemo`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `SigningActivityChart` | component | `SigningActivityChart({ activity, loading, }: { activity: DsAnalyticsSummary["sig…)` | 16 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/docusign/types.ts` — `DsAnalyticsSummary`, `(types only)`
- **Packages:**
  - `react` — `useMemo`
  - `recharts` — `Bar`, `BarChart`, `CartesianGrid`, `ResponsiveContainer`, `Tooltip`, `XAxis`, …

## Used by

- `components/dashboard/docusign/DocusignDashboardView.tsx`
