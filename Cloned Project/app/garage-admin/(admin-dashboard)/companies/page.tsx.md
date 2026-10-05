# `app/garage-admin/(admin-dashboard)/companies/page.tsx`

> Companies — Admin → Citizens → Companies.

**Kind:** Next.js page · **Lines:** 1333 · **Directive:** `"use client"` · **Route:** `/garage-admin/companies` (page)

<!-- docgen:auto -->

## Purpose
Companies — Admin → Citizens → Companies.

Every organization on Garage with its subscription lifecycle, member /
customer counts, and GaragePay revenue. Same reusable Bigin-style
DataTable as One Time Affiliates / Users.

Backend: GET /garage-admin/organizations (controller getAllOrganizations)
returns the whole list — no server pagination — so paging is client-side.
"Assign"/"Change" posts to /garage-admin/organizations/:id/assign-admin,
which is SUPER-ADMIN only; regular admins see the assignment read-only.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Money`×5 (local), `Avatar`×4 (local), `PillButton`×3 (local), `DangerConfirmDialog`×2 (components/garage-admin/DangerConfirmDialog.tsx), `X`×2 (lucide-react), `Loader2`×2 (lucide-react), `BrandDot`×2 (local), `ChevronDown`×2 (lucide-react), `DateInvoiceCell`×2 (local), `InvoiceDetailDrawer` (components/garage-admin/InvoiceDetailDrawer.tsx), `AssignAdminDialog` (local), `DataTable` (components/data-table/DataTable.tsx), `BulkActionBar` (local), `TopBar` (local), `Check` (lucide-react), `Pencil` (lucide-react), `Trash2` (lucide-react), `MoreHorizontal` (lucide-react), `SlidersHorizontal` (lucide-react), `MoreVertical` (lucide-react), `OrgIcon` (local), `FounderCell` (local), `UplineCell` (local), `LocationCell` (local)

**Hooks used:** `useState`×21, `useMemo`×7, `useEffect`×4, `useAdminAccess`×2 (components/garage-admin/use-admin-access.ts), `usePathname` (next/navigation), `useRouter` (next/navigation)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (CompaniesPage)` | component | `CompaniesPage()` | 137 |

## Interfaces

- **garage-admin API called (`my.revenue.network`):**
  - `GET /garage-admin/admins` (L550)
  - `POST /garage-admin/organizations/${org.id}/assign-admin` (L581)
- **Browser storage / cookies:** `garage_admin_token` (localStorage: remove), `garage_admin_info` (localStorage: remove)

## Dependencies

- **Internal:**
  - `lib/api.ts` — `garageAdminApi`
  - `lib/admin-api/danger-zone.ts` — `getOrgDeletePreview`, `deleteAdminOrganization`, `OrgDeletePreview`
  - `components/garage-admin/DangerConfirmDialog.tsx` — `DangerConfirmDialog (default)`
  - `components/garage-admin/use-admin-access.ts` — `useAdminAccess`
  - `components/data-table/DataTable.tsx` — `DataTable`
  - `components/data-table/filter.ts` — `applyColumnFilters`
  - `components/data-table/types.ts` — `ColumnDef`, `(types only)`
  - `lib/country-flag.ts` — `getCountryFlag`
  - `components/garage-admin/InvoiceDetailDrawer.tsx` — `InvoiceDetailDrawer`
  - `lib/admin-api/permissions.ts` — `isSuperAdminClient`
- **Packages:**
  - `react` — `useEffect`, `useMemo`, `useState`
  - `next` — `usePathname`, `useRouter`
  - `sonner` — `toast`
  - `lucide-react` — `ChevronDown`, `SlidersHorizontal`, `Pencil`, `MoreHorizontal`, `MoreVertical`, `X`, …

## Used by

- `app/garage-admin/(admin-dashboard)/companies/free/page.tsx`
- `app/garage-admin/(admin-dashboard)/companies/paid/page.tsx`

Entry: reached by the Next.js router at `/garage-admin/companies` (page).
