# `app/garage-admin/(admin-dashboard)/daily-reports/page.tsx`

> Daily Reports — Admin → Analytics → Daily Reports.

**Kind:** Next.js page · **Lines:** 735 · **Directive:** `"use client"` · **Route:** `/garage-admin/daily-reports` (page)

<!-- docgen:auto -->

## Purpose
Daily Reports — Admin → Analytics → Daily Reports.

"What did we sell, and to whom": every paid Founders Office, Unilevel Plus
and crypto white-label invoice in an IST date window, one row per buyer
with that buyer's invoices inside the row. Same DataTable / top bar /
filter drawer vocabulary as NetworkChain Subs so the two read as one
panel; the difference is the unit of the row (a person's day of
purchases, not a subscription).

Data: GET /garage-admin/daily-reports (garagenew-backend
routes/garageAdminDailyReports.ts). Page key `daily_reports` — grantable to
non-super admins as a view-only page.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Money`×7 (local), `CopyBtn`×4 (local), `UserCell`×2 (local), `DailyReportsFilterDrawer` (components/garage-admin/DailyReportsFilterDrawer.tsx), `DataTable` (components/data-table/DataTable.tsx), `TopBar` (local), `SlidersHorizontal` (lucide-react), `ChevronDown` (lucide-react), `Users` (lucide-react), `X` (lucide-react), `InvoiceLine` (local), `KindsCell` (local), `ExternalLink` (lucide-react), `CheckIcon` (lucide-react), `Copy` (lucide-react), `Avatar` (local)

**Hooks used:** `useState`×13, `useEffect`×3, `useRouter` (next/navigation), `useAdminAccess` (components/garage-admin/use-admin-access.ts), `useAdminSearch` (components/garage-admin/admin-search.tsx), `useMemo`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (DailyReportsPage)` | component | `DailyReportsPage()` | 75 |

## Interfaces

- **Browser storage / cookies:** `garage_admin_token` (localStorage: remove), `garage_admin_info` (localStorage: remove)
- **Timers / queues:** `setTimeout` at L95, L650

## Dependencies

- **Internal:**
  - `components/data-table/DataTable.tsx` — `DataTable`
  - `components/data-table/types.ts` — `ColumnDef`, `SortState`, `(types only)`
  - `components/garage-admin/admin-search.tsx` — `useAdminSearch`
  - `components/garage-admin/use-admin-access.ts` — `useAdminAccess`
  - `lib/country-flag.ts` — `getCountryFlag`
  - `components/garage-admin/DailyReportsFilterDrawer.tsx` — `DailyReportsFilterDrawer`, `DailyReportsFilters`
  - `lib/admin-api/daily-reports.ts` — `getDailyReports`, `defaultRange`, `formatIst`, `presetForRange`, `rangeSummary`, `RANGE_PRESETS`, `KIND_LABEL`, `KIND_ORDER`, … +7
- **Packages:**
  - `react` — `useEffect`, `useMemo`, `useState`
  - `next` — `useRouter`
  - `sonner` — `toast`
  - `lucide-react` — `Check as CheckIcon`, `ChevronDown`, `Copy`, `ExternalLink`, `SlidersHorizontal`, `Users`, …

## Used by

Entry: reached by the Next.js router at `/garage-admin/daily-reports` (page).
