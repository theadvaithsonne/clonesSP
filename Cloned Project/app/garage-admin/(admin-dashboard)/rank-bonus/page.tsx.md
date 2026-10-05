# `app/garage-admin/(admin-dashboard)/rank-bonus/page.tsx`

> NetworkChain monthly rank bonus — admin surface.

**Kind:** Next.js page · **Lines:** 1195 · **Directive:** `"use client"` · **Route:** `/garage-admin/rank-bonus` (page)

<!-- docgen:auto -->

## Purpose
NetworkChain monthly rank bonus — admin surface.

Two views behind one page:
  People  — everyone in the tree, their subscription state, who referred them,
            their rank. Click a row for the full why-this-rank breakdown.
  Runs    — the monthly job history, with a dry-run trigger for the current
            period so the bill can be previewed before any money moves.

Backend: garagenew-backend/src/routes/garageAdminRankBonus.ts

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Kpi`×4 (local), `RankBadge`×3 (components/garage-admin/RankBadge.tsx), `Loader2`×3 (lucide-react), `Play`×3 (lucide-react), `RefreshCw`×2 (lucide-react), `RunTotalsStrip`×2 (local), `Avatar` (local), `ActivePill` (components/garage-admin/RankBadge.tsx), `X` (lucide-react), `Trophy` (lucide-react), `ShieldCheck` (lucide-react), `ShieldAlert` (lucide-react), `RankDistribution` (local), `DataTable` (components/data-table/DataTable.tsx), `RunsView` (local), `RankPersonDrawer` (components/garage-admin/RankPersonDrawer.tsx), `RunCard` (local)

**Hooks used:** `useState`×23, `useEffect`×4, `useCallback`×3, `useMemo`×2, `useRouter` (next/navigation), `useAdminSearch` (components/garage-admin/admin-search.tsx)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (RankBonusPage)` | component | `RankBonusPage()` | 249 |

## Interfaces

- **garage-admin API called (`my.revenue.network`):**
  - `GET /garage-admin/rank-bonus/people?${qs.toString()}` (L317)
  - `GET /garage-admin/rank-bonus/runs?limit=24` (L343)
  - `GET /garage-admin/rank-bonus/current` (L347)
  - `GET /garage-admin/rank-bonus/plan` (L353)
  - `POST /garage-admin/rank-bonus/runs/${periodKey}/execute` (L394)
- **Browser storage / cookies:** `garage_admin_token` (localStorage: remove), `garage_admin_info` (localStorage: remove)
- **Timers / queues:** `setTimeout` at L284

## Dependencies

- **Internal:**
  - `lib/api.ts` — `garageAdminApi`
  - `components/garage-admin/admin-search.tsx` — `useAdminSearch`
  - `components/data-table/DataTable.tsx` — `DataTable`
  - `components/data-table/types.ts` — `ColumnDef`, `SortState`, `(types only)`
  - `components/garage-admin/RankBadge.tsx` — `RankBadge`, `ActivePill`
  - `components/garage-admin/RankPersonDrawer.tsx` — `RankPersonDrawer`
- **Packages:**
  - `react` — `useCallback`, `useEffect`, `useMemo`, `useState`
  - `next` — `useRouter`
  - `sonner` — `toast`
  - `lucide-react` — `Play`, `RefreshCw`, `ShieldAlert`, `ShieldCheck`, `Users`, `CalendarClock`, …

## Used by

Entry: reached by the Next.js router at `/garage-admin/rank-bonus` (page).
