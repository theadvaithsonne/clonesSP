# `components/dashboard/docusign/analytics/DocumentStatusDonut.tsx`

> React component `DocumentStatusDonut`.

**Kind:** React component · **Lines:** 59 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `ResponsiveContainer` (recharts), `PieChart` (recharts), `Pie` (recharts), `Cell` (recharts)

### Props

- **`DocumentStatusDonut`**: `totals: DsAnalyticsSummary["totals"] | null`, `loading?: boolean`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `DocumentStatusDonut` | component | `DocumentStatusDonut({ totals, loading }: { totals: DsAnalyticsSummary["totals"]…)` | 15 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/docusign/types.ts` — `DsAnalyticsSummary`, `(types only)`
- **Packages:**
  - `recharts` — `Cell`, `Pie`, `PieChart`, `ResponsiveContainer`

## Used by

- `components/dashboard/docusign/DocusignDashboardView.tsx`
