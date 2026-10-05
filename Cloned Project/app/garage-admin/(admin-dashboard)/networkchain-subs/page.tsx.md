# `app/garage-admin/(admin-dashboard)/networkchain-subs/page.tsx`

> NetworkChain Subs — Admin → Citizens → NetworkChain Subs.

**Kind:** Next.js page · **Lines:** 1134 · **Directive:** `"use client"` · **Route:** `/garage-admin/networkchain-subs` (page)

<!-- docgen:auto -->

## Purpose
NetworkChain Subs — Admin → Citizens → NetworkChain Subs.

Uses the reusable Bigin-style DataTable (copied from the NC frontend,
components/data-table/*). Column resize, reorder, sort menu, and layout
persistence come for free from the shared component; this file just
declares the 10 columns Shorupan drew in Figma frame 39:1521 and wires
up the top bar + footer totals + pagination.

Data: GET /garage-admin/networkchain-subs (garagenew-backend
routes/garageAdminNetworkChainSubs.ts).

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Pill`×7 (local), `UserCell`×4 (local), `CopyBtn`×3 (local), `InvoiceLink`×3 (local), `ChevronDown`×2 (lucide-react), `PaymentDetailsCell`×2 (local), `NetworkChainSubsFilterDrawer` (components/garage-admin/NetworkChainSubsFilterDrawer.tsx), `InvoiceDetailDrawer` (components/garage-admin/InvoiceDetailDrawer.tsx), `AssignAgentDialog` (components/garage-admin/assign-agent.tsx), `AffiliateMemberDrawer` (components/garage-admin/AffiliateMemberDrawer.tsx), `DataTable` (components/data-table/DataTable.tsx), `BulkActionBar` (local), `TopBar` (local), `Pencil` (lucide-react), `MoreHorizontal` (lucide-react), `X` (lucide-react), `SlidersHorizontal` (lucide-react), `BrandDot` (local), `Plus` (lucide-react), `StatusPill` (local), `LocationCell` (local), `AssignedCell` (components/garage-admin/assign-agent.tsx), `AutoDebitCell` (local), `NextPaymentCell` (local), `RankCell` (local), `CheckIcon` (lucide-react), `Copy` (lucide-react), `Avatar` (local), `CheckCircle2` (lucide-react), `Trash2` (lucide-react), `Clock` (lucide-react), `Hourglass` (lucide-react), `InvoiceStatusBadge` (local)

**Hooks used:** `useState`×17, `useEffect`×3, `useMemo`×2, `useAdminAccess` (components/garage-admin/use-admin-access.ts), `useRouter` (next/navigation), `useAdminSearch` (components/garage-admin/admin-search.tsx)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (NetworkChainSubsPage)` | component | `NetworkChainSubsPage()` | 161 |

## Interfaces

- **garage-admin API called (`my.revenue.network`):**
  - `GET /garage-admin/networkchain-subs?${qs.toString()}` (L236)
- **Browser storage / cookies:** `garage_admin_token` (localStorage: remove), `garage_admin_info` (localStorage: remove)
- **Timers / queues:** `setTimeout` at L201, L695

## Dependencies

- **Internal:**
  - `lib/api.ts` — `garageAdminApi`
  - `components/garage-admin/assign-agent.tsx` — `AssignAgentDialog`, `AssignedCell`, `AssignedAgent`
  - `components/garage-admin/admin-search.tsx` — `useAdminSearch`
  - `lib/country-flag.ts` — `getCountryFlag`
  - `components/data-table/DataTable.tsx` — `DataTable`
  - `components/data-table/types.ts` — `ColumnDef`, `SortState`, `(types only)`
  - `components/garage-admin/NetworkChainSubsFilterDrawer.tsx` — `NetworkChainSubsFilterDrawer`, `NcSubsFilters`
  - `components/garage-admin/InvoiceDetailDrawer.tsx` — `InvoiceDetailDrawer`
  - `components/garage-admin/AffiliateMemberDrawer.tsx` — `AffiliateMemberDrawer`
  - `components/garage-admin/use-admin-access.ts` — `useAdminAccess`
- **Packages:**
  - `react` — `useEffect`, `useMemo`, `useState`
  - `next` — `useRouter`
  - `sonner` — `toast`
  - `lucide-react` — `CheckCircle2`, `Trash2`, `Hourglass`, `Clock`, `ChevronDown`, `Plus`, …

## Used by

Entry: reached by the Next.js router at `/garage-admin/networkchain-subs` (page).
