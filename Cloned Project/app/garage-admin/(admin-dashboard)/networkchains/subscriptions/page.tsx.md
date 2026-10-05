# `app/garage-admin/(admin-dashboard)/networkchains/subscriptions/page.tsx`

> Next.js page rendered at `/garage-admin/networkchains/subscriptions`.

**Kind:** Next.js page · **Lines:** 489 · **Directive:** `"use client"` · **Route:** `/garage-admin/networkchains/subscriptions` (page)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Check` (lucide-react), `X` (lucide-react), `DataTable` (components/data-table/DataTable.tsx), `SelectionBar` (components/data-table/SelectionBar.tsx), `Loader2` (lucide-react), `TableTopBar` (components/data-table/TableTopBar.tsx), `ExportButton` (components/data-table/ExportPanel.tsx), `AppliedFilterChips` (components/data-table/AppliedFilterChips.tsx), `FilterDrawer` (components/data-table/FilterDrawer.tsx), `ExportPanel` (components/data-table/ExportPanel.tsx)

**Hooks used:** `useState`×17, `useMemo`×4, `useCallback`×2, `useEffect`×2, `useAdminAccess` (components/garage-admin/use-admin-access.ts), `useAdminSearch` (components/garage-admin/admin-search.tsx), `useDebouncedValue` (lib/hooks/use-debounced-value.ts), `useRef`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (SubscriptionsPage)` | component | `SubscriptionsPage()` | 63 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/data-table/DataTable.tsx` — `DataTable`
  - `components/data-table/TableTopBar.tsx` — `TableTopBar`, `TopBarView`
  - `components/data-table/AppliedFilterChips.tsx` — `AppliedFilterChips`, `FilterChip`
  - `components/data-table/SelectionBar.tsx` — `SelectionBar`
  - `components/data-table/FilterDrawer.tsx` — `FilterDrawer`, `facetField`, `numericRangeField`, `FilterField`
  - `components/data-table/types.ts` — `ColumnDef`, `SortState`, `(types only)`
  - `components/data-table/ExportPanel.tsx` — `ExportPanel`, `ExportButton`, `ExportField`
  - `lib/hooks/use-debounced-value.ts` — `useDebouncedValue`
  - `lib/nc-admin-api/admin.ts` — `getSubscriptionUsers`, `activateSubscription`, `expireSubscription`, `AdminUnauthorizedError`, `SubUser`
  - `lib/nc-admin-api/auth.ts` — `ensureNcAdminToken`
  - `components/garage-admin/use-admin-access.ts` — `useAdminAccess`
  - `components/garage-admin/admin-search.tsx` — `useAdminSearch`
- **Packages:**
  - `react` — `useCallback`, `useEffect`, `useMemo`, `useRef`, `useState`
  - `lucide-react` — `Loader2`, `Check`, `X`, `Shield`, `Hash`, `CalendarClock`

## Used by

Entry: reached by the Next.js router at `/garage-admin/networkchains/subscriptions` (page).
