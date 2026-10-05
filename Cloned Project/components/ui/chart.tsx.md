# `components/ui/chart.tsx`

> React components `ChartContainer`, `ChartTooltipContent`.

**Kind:** UI primitive (shadcn/Radix wrapper) · **Lines:** 118 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `ChartContext` (local), `ResponsiveContainer` (recharts)

### Props

- **`ChartContainer`**: `id`, `className`, `children`, `config`, `props`
- **`ChartTooltipContent`**: `active?: boolean`, `payload?: any[]`, `label?: string`, `className?: string`, `formatter?: (value: any, name: string) => React.ReactNode`

**Hooks used:** `useChart` (local)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `ChartConfig` | type |  | 9 |
| `ChartContainer` | component | `ChartContainer({ id, className, children, config, ...props }: React.Compon…)` | 117 |
| `ChartTooltip` | export |  | 117 |
| `ChartTooltipContent` | component | `ChartTooltipContent({ active, payload, label, className, formatter, }: { active…)` | 117 |
| `useChart` | hook | `useChart()` | 117 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/utils.ts` — `cn`
- **Packages:**
  - `react`
  - `recharts` — `ResponsiveContainer`, `Tooltip`

## Used by

- `components/dashboard/OpenClawAgentTabs.tsx`
