# `app/garage-admin/(admin-dashboard)/networkchains/offerings/page.tsx`

> Next.js page rendered at `/garage-admin/networkchains/offerings`.

**Kind:** Next.js page · **Lines:** 585 · **Directive:** `"use client"` · **Route:** `/garage-admin/networkchains/offerings` (page)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `StatCard`×4 (local), `PlatformLogo`×2 (components/icons/platform-logos.tsx), `OfferingIcon` (local), `DataTable` (components/data-table/DataTable.tsx), `TableTopBar` (components/data-table/TableTopBar.tsx), `ExportButton` (components/data-table/ExportPanel.tsx), `AppliedFilterChips` (components/data-table/AppliedFilterChips.tsx), `OfferingDetailDrawer` (local), `ExportPanel` (components/data-table/ExportPanel.tsx), `Ticket` (lucide-react), `Tag` (lucide-react), `X` (lucide-react), `Loader2` (lucide-react)

**Hooks used:** `useState`×17, `useEffect`×4, `useCallback`×2, `useAdminSearch` (components/garage-admin/admin-search.tsx), `useRef`, `useMemo`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (OfferingsPage)` | component | `OfferingsPage()` | 94 |

## Interfaces

- **Timers / queues:** `setTimeout` at L133

## Dependencies

- **Internal:**
  - `components/data-table/DataTable.tsx` — `DataTable`
  - `components/data-table/TableTopBar.tsx` — `TableTopBar`, `TopBarView`
  - `components/data-table/AppliedFilterChips.tsx` — `AppliedFilterChips`, `FilterChip`
  - `components/data-table/types.ts` — `ColumnDef`, `SortState`, `(types only)`
  - `components/data-table/ExportPanel.tsx` — `ExportPanel`, `ExportButton`, `ExportField`
  - `lib/nc-admin-api/admin.ts` — `getOfferings`, `getOfferingDetail`, `AdminUnauthorizedError`, `Offering`, `OfferingCategory`, `OfferingDetailResponse`
  - `lib/nc-admin-api/auth.ts` — `ensureNcAdminToken`
  - `components/icons/platform-logos.tsx` — `PlatformLogo`
  - `components/garage-admin/admin-search.tsx` — `useAdminSearch`
- **Packages:**
  - `react` — `useCallback`, `useEffect`, `useMemo`, `useRef`, `useState`
  - `lucide-react` — `Tag`, `Ticket`, `Loader2`, `X`

## Used by

Entry: reached by the Next.js router at `/garage-admin/networkchains/offerings` (page).
