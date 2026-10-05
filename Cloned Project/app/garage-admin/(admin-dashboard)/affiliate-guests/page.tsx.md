# `app/garage-admin/(admin-dashboard)/affiliate-guests/page.tsx`

> Affiliate Guests — Admin → Citizens → Affiliate Guests.

**Kind:** Next.js page · **Lines:** 580 · **Directive:** `"use client"` · **Route:** `/garage-admin/affiliate-guests` (page)

<!-- docgen:auto -->

## Purpose
Affiliate Guests — Admin → Citizens → Affiliate Guests.

Every user with at least one `organizations.$.guest === true` membership
(the default state for OTP-signup users in GARAGE HQ + anyone founders
admitted as a guest via a join request). Super-admin can graduate any
individual membership to full-member (guest → false) with one click.

Rendered through the same Bigin-style DataTable
(components/data-table/*) as Founders / One Time Affiliates / Users so
column resize, reorder, and layout persistence come for free. Endpoint
returns the full (capped) list, so paging + footer totals are computed
client-side; search stays server-side.

Backend: GET /garage-admin/affiliate-guests → { success, rows, total, returned }
PATCH   /garage-admin/affiliate-guests/:userId/orgs/:orgId/graduate

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `DataTable` (components/data-table/DataTable.tsx), `BulkActionBar` (local), `TopBar` (local), `X` (lucide-react), `SlidersHorizontal` (lucide-react), `UserCell` (local), `ReferredPill` (local), `MembershipsCell` (local), `Avatar` (local), `Building2` (lucide-react), `Loader2` (lucide-react), `CheckCircle2` (lucide-react)

**Hooks used:** `useState`×10, `useMemo`×6, `useEffect`×4, `useAdminAccess` (components/garage-admin/use-admin-access.ts), `useRouter` (next/navigation), `useAdminSearch` (components/garage-admin/admin-search.tsx)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (AffiliateGuestsPage)` | component | `AffiliateGuestsPage()` | 64 |

## Interfaces

- **garage-admin API called (`my.revenue.network`):**
  - `` GET /garage-admin/affiliate-guests${qs.toString() ? `?${qs.toString()}` : ""} `` (L105)
  - `PATCH /garage-admin/affiliate-guests/${userId}/orgs/${orgId}/graduate` (L138)
- **Browser storage / cookies:** `garage_admin_token` (localStorage: remove), `garage_admin_info` (localStorage: remove)
- **Timers / queues:** `setTimeout` at L86

## Dependencies

- **Internal:**
  - `lib/api.ts` — `garageAdminApi`
  - `components/garage-admin/admin-search.tsx` — `useAdminSearch`
  - `components/data-table/DataTable.tsx` — `DataTable`
  - `components/data-table/filter.ts` — `applyColumnFilters`
  - `components/data-table/types.ts` — `ColumnDef`, `(types only)`
  - `components/garage-admin/use-admin-access.ts` — `useAdminAccess`
- **Packages:**
  - `react` — `useEffect`, `useMemo`, `useState`
  - `next` — `useRouter`
  - `sonner` — `toast`
  - `lucide-react` — `Building2`, `CheckCircle2`, `Loader2`, `SlidersHorizontal`, `X`

## Used by

Entry: reached by the Next.js router at `/garage-admin/affiliate-guests` (page).
