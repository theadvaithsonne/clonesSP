# `app/garage-admin/(admin-dashboard)/founders/page.tsx`

> Founders — Admin → Citizens → Founders.

**Kind:** Next.js page · **Lines:** 572 · **Directive:** `"use client"` · **Route:** `/garage-admin/founders` (page)

<!-- docgen:auto -->

## Purpose
Founders — Admin → Citizens → Founders.

Every user who holds a founder membership on any org, rendered through the
same reusable Bigin-style DataTable (components/data-table/*) as One Time
Affiliates / Users, so column resize, reorder, and layout persistence come
for free. The endpoint returns the full list (no server pagination), so
paging + footer totals are computed client-side; search stays server-side.

Backend: GET /garage-admin/founders (garagenew-backend controller
getAllFounders) → { success, data: Founder[] }.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `StatusPill`×2 (local), `DataTable` (components/data-table/DataTable.tsx), `BulkActionBar` (local), `TopBar` (local), `Pencil` (lucide-react), `MoreHorizontal` (lucide-react), `X` (lucide-react), `SlidersHorizontal` (lucide-react), `BrandDot` (local), `ChevronDown` (lucide-react), `UserCell` (local), `OrgsCell` (local), `LocationCell` (local), `Avatar` (local), `Building2` (lucide-react), `CheckCircle2` (lucide-react), `XCircle` (lucide-react)

**Hooks used:** `useState`×8, `useMemo`×6, `useEffect`×4, `useRouter` (next/navigation), `useAdminSearch` (components/garage-admin/admin-search.tsx)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (FoundersPage)` | component | `FoundersPage()` | 61 |

## Interfaces

- **garage-admin API called (`my.revenue.network`):**
  - `` GET /garage-admin/founders${qs.toString() ? `?${qs.toString()}` : ""} `` (L94)
- **Browser storage / cookies:** `garage_admin_token` (localStorage: remove), `garage_admin_info` (localStorage: remove)
- **Timers / queues:** `setTimeout` at L75

## Dependencies

- **Internal:**
  - `lib/api.ts` — `garageAdminApi`
  - `components/garage-admin/admin-search.tsx` — `useAdminSearch`
  - `lib/country-flag.ts` — `getCountryFlag`
  - `components/data-table/DataTable.tsx` — `DataTable`
  - `components/data-table/filter.ts` — `applyColumnFilters`
  - `components/data-table/types.ts` — `ColumnDef`, `(types only)`
- **Packages:**
  - `react` — `useEffect`, `useMemo`, `useState`
  - `next` — `useRouter`
  - `sonner` — `toast`
  - `lucide-react` — `ChevronDown`, `SlidersHorizontal`, `Building2`, `Pencil`, `MoreHorizontal`, `X`, …

## Used by

Entry: reached by the Next.js router at `/garage-admin/founders` (page).
