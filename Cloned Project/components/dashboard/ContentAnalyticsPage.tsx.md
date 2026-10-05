# `components/dashboard/ContentAnalyticsPage.tsx`

> React component `ContentAnalyticsPage`.

**Kind:** React component · **Lines:** 488 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `StatCard`×8 (local), `Icon`×3 (local), `Loader2`×2 (lucide-react), `AlertCircle`×2 (lucide-react), `EmptyState`×2 (local), `Trophy`×2 (lucide-react), `AffiliateRow`×2 (local), `ArrowUpRight` (lucide-react), `DevIcon` (local), `Activity` (lucide-react), `LeaderboardRow` (local), `BarChart3` (lucide-react), `User` (lucide-react), `ContentTypeCard` (local), `TopContentRow` (local), `LeaderboardView` (local)

**Hooks used:** `useState`×10, `useEffect`×2, `useMemo`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `ContentAnalyticsPage` | component | `ContentAnalyticsPage()` | 319 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/content-analytics-api.ts` — `fetchOverview`, `fetchLeaderboard`, `OverviewData`, `LeaderboardData`, `LeaderboardItem`, `ContentTypeStats`, `TopAffiliate`, `TopContentItem`, … +1
- **Packages:**
  - `react` — `useState`, `useEffect`, `useMemo`
  - `lucide-react` — `BarChart3`, `Eye`, `Clock`, `Users`, `TrendingUp`, `CheckCircle2`, …

## Used by

- `components/dashboard/RevenueNetworkPages.tsx`
