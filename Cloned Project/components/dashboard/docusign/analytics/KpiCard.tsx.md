# `components/dashboard/docusign/analytics/KpiCard.tsx`

> React component `KpiCard`.

**Kind:** React component · **Lines:** 73 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `ArrowUpRight` (lucide-react), `ArrowDownRight` (lucide-react), `Minus` (lucide-react), `ResponsiveContainer` (recharts), `AreaChart` (recharts), `Area` (recharts)

### Props

- **`KpiCard`**: `label: string`, `kpi: DsAnalyticsKpi | null`, `color?: string`, `loading?: boolean`

**Hooks used:** `useId`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `KpiCard` | component | `KpiCard({ label, kpi, color = "#FBD10D", loading, }: { label: strin…)` | 9 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/utils.ts` — `cn`
  - `lib/docusign/types.ts` — `DsAnalyticsKpi`, `(types only)`
- **Packages:**
  - `react` — `useId`
  - `recharts` — `Area`, `AreaChart`, `ResponsiveContainer`
  - `lucide-react` — `ArrowDownRight`, `ArrowUpRight`, `Minus`

## Used by

- `components/dashboard/docusign/DocusignDashboardView.tsx`
