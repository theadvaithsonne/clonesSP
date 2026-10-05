# `app/garage-admin/(admin-dashboard)/one-time-affiliates/page.tsx`

> One Time Affiliates — Admin → Citizens → One Time Affiliates.

**Kind:** Next.js page · **Lines:** 1474 · **Directive:** `"use client"` · **Route:** `/garage-admin/one-time-affiliates` (page)

<!-- docgen:auto -->

## Purpose
One Time Affiliates — Admin → Citizens → One Time Affiliates.

Everyone who has paid the $25 Unilevel Plus license, whether or not
they've since become an active NetworkChain subscriber. Table matches
Shorupan's Figma frame 77:3 (Garage-Dashboard file).

Backend: GET /garage-admin/one-time-affiliates (garagenew-backend
routes/garageAdminOneTimeAffiliates.ts).

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `UserCell`×3 (local), `CopyBtn`×3 (local), `OneTimeAffiliatesFilterDrawer` (components/garage-admin/OneTimeAffiliatesFilterDrawer.tsx), `CompanyScopeDialog` (components/garage-admin/CompanyScopeDialog.tsx), `AssignAgentDialog` (components/garage-admin/assign-agent.tsx), `IgniteCallScheduleDrawer` (components/garage-admin/catchup/IgniteCallScheduleDrawer.tsx), `IgniteCallDrawer` (components/garage-admin/IgniteCallDrawer.tsx), `InvoiceDetailDrawer` (components/garage-admin/InvoiceDetailDrawer.tsx), `AffiliateMemberDrawer` (components/garage-admin/AffiliateMemberDrawer.tsx), `DataTable` (components/data-table/DataTable.tsx), `BulkActionBar` (local), `TopBar` (local), `Pencil` (lucide-react), `MoreHorizontal` (lucide-react), `X` (lucide-react), `SlidersHorizontal` (lucide-react), `ScopeAvatar` (components/garage-admin/CompanyScopeDialog.tsx), `BrandDot` (local), `ChevronDown` (lucide-react), `Loader2` (lucide-react), `Download` (lucide-react), `LocationCell` (local), `NvcChatCell` (local), `AssignedCell` (components/garage-admin/assign-agent.tsx), `IgniteCallCell` (components/garage-admin/ignite-call.tsx), `JoiningCell` (local), `SavedInstrumentChips` (local), `CommercialsCell` (local), `CheckIcon` (lucide-react), `Copy` (lucide-react), `Avatar` (local)

**Hooks used:** `useState`×22, `useEffect`×3, `useMemo`×2, `useRouter` (next/navigation), `useAdminSearch` (components/garage-admin/admin-search.tsx), `useAdminAccess` (components/garage-admin/use-admin-access.ts)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (OneTimeAffiliatesPage)` | component | `OneTimeAffiliatesPage()` | 249 |

## Interfaces

- **garage-admin API called (`my.revenue.network`):**
  - `GET /garage-admin/one-time-affiliates?${qs.toString()}` (L371)
  - `GET /garage-admin/one-time-affiliates?${buildQuery(
            EXPORT_PAGE_SIZE,
            offset
          ).toString()}` (L421)
  - `POST /garage-admin/users/${row.userId}/nvc-chat` (L491)
- **Browser storage / cookies:** `garage_admin_token` (localStorage: remove), `garage_admin_info` (localStorage: remove)
- **Timers / queues:** `setTimeout` at L324, L1208

## Dependencies

- **Internal:**
  - `lib/api.ts` — `garageAdminApi`
  - `components/garage-admin/assign-agent.tsx` — `AssignAgentDialog`, `AssignedCell`, `AssignedAgent`
  - `components/garage-admin/admin-search.tsx` — `useAdminSearch`
  - `lib/country-flag.ts` — `getCountryFlag`
  - `lib/csvExport.ts` — `exportRowsAsCsv`, `CsvColumn`
  - `components/data-table/DataTable.tsx` — `DataTable`
  - `components/data-table/types.ts` — `ColumnDef`, `SortState`, `(types only)`
  - `components/garage-admin/use-admin-access.ts` — `useAdminAccess`
  - `components/garage-admin/InvoiceDetailDrawer.tsx` — `InvoiceDetailDrawer`
  - `components/garage-admin/AffiliateMemberDrawer.tsx` — `AffiliateMemberDrawer`
  - `components/garage-admin/CompanyScopeDialog.tsx` — `CompanyScopeDialog`, `ScopeAvatar`, `ScopePerson`
  - `components/garage-admin/OneTimeAffiliatesFilterDrawer.tsx` — `OneTimeAffiliatesFilterDrawer`, `applyFiltersToQuery`, `hasAnyFilter`, `LocationFacet`, `OneTimeAffiliateFilters`
  - `components/garage-admin/ignite-call.tsx` — `IgniteCallCell`
  - `components/garage-admin/catchup/IgniteCallScheduleDrawer.tsx` — `IgniteCallScheduleDrawer`
  - `components/garage-admin/IgniteCallDrawer.tsx` — `IgniteCallDrawer`
  - `lib/admin-api/ignite-call.ts` — `IGNITE_STATUS_LABEL`, `IgniteCallSummary`
- **Packages:**
  - `react` — `useEffect`, `useMemo`, `useState`
  - `next` — `useRouter`
  - `sonner` — `toast`
  - `lucide-react` — `ChevronDown`, `Download`, `Loader2`, `SlidersHorizontal`, `X`, `Pencil`, …

## Used by

Entry: reached by the Next.js router at `/garage-admin/one-time-affiliates` (page).
