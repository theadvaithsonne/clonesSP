# `components/garage-admin/MemberActivityChart.tsx`

> Downline member profile — the monthly activity chart in the header.

**Kind:** React component · **Lines:** 246 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
Downline member profile — the monthly activity chart in the header.

ONE series is shown at a time: the switch swaps between what the member
spent and what the viewer earned from them. That is why there is no legend —
the title names the series, so identity is never carried by colour alone.
Both series are cents from GET /affiliate/downline/:userId/monthly.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Select` (components/ui/select.tsx), `SelectTrigger` (components/ui/select.tsx), `SelectValue` (components/ui/select.tsx), `SelectContent` (components/ui/select.tsx), `SelectItem` (components/ui/select.tsx), `ResponsiveContainer` (recharts), `BarChart` (recharts), `XAxis` (recharts), `YAxis` (recharts), `Tooltip` (recharts), `Bar` (recharts), `Switch` (components/ui/switch.tsx)

### Props

- **`MemberActivityChart`**: `userId: string`, `memberName?: string`, `className?: string`, `showEarnings?: boolean`

**Hooks used:** `useState`×2, `useMemo`×2, `useQuery` (@tanstack/react-query)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `MemberActivityChart` | component | `MemberActivityChart({ userId, memberName, className, showEarnings = true, }: { …)` | 69 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/ui/select.tsx` — `Select`, `SelectContent`, `SelectItem`, `SelectTrigger`, `SelectValue`
  - `components/ui/switch.tsx` — `Switch`
  - `lib/affiliate/downline-monthly-api.ts` — `fetchMemberMonthly`
- **Packages:**
  - `react` — `useMemo`, `useState`
  - `@tanstack/react-query` — `useQuery`
  - `recharts` — `Bar`, `BarChart`, `ResponsiveContainer`, `Tooltip`, `XAxis`, `YAxis`

## Used by

- `components/garage-admin/member-profile-view.tsx`
