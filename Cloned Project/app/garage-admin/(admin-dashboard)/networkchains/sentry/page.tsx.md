# `app/garage-admin/(admin-dashboard)/networkchains/sentry/page.tsx`

> Next.js page rendered at `/garage-admin/networkchains/sentry`.

**Kind:** Next.js page · **Lines:** 385 · **Directive:** `"use client"` · **Route:** `/garage-admin/networkchains/sentry` (page)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `ProductSwitch` (components/nc-admin/product-switch.tsx), `UnavailableState` (components/nc-admin/sentry/unavailable-state.tsx), `DataTable` (components/data-table/DataTable.tsx), `TableTopBar` (components/data-table/TableTopBar.tsx), `ExportButton` (components/data-table/ExportPanel.tsx), `AppliedFilterChips` (components/data-table/AppliedFilterChips.tsx), `ExportPanel` (components/data-table/ExportPanel.tsx)

**Hooks used:** `useState`×12, `useEffect`×4, `useCallback`×4, `useRef`×3, `useMemo`×2, `useRouter` (next/navigation), `useAdminSearch` (components/garage-admin/admin-search.tsx), `useAdminProduct` (lib/admin/product.ts)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (AdminSentryPage)` | component | `AdminSentryPage()` | 62 |

## Interfaces

- **Timers / queues:** `setTimeout` at L142

## Dependencies

- **Internal:**
  - `components/data-table/DataTable.tsx` — `DataTable`
  - `components/data-table/TableTopBar.tsx` — `TableTopBar`, `TopBarView`
  - `components/data-table/AppliedFilterChips.tsx` — `AppliedFilterChips`, `FilterChip`
  - `components/data-table/types.ts` — `ColumnDef`, `(types only)`
  - `components/data-table/ExportPanel.tsx` — `ExportPanel`, `ExportButton`, `ExportField`
  - `lib/nc-admin-api/admin-sentry.ts` — `listProjects`, `listIssues`, `levelClass`, `relTime`, `SentryProject`, `SentryIssue`, `SentrySort`, `SentryStatsPeriod`, … +1
  - `lib/nc-admin-api/admin.ts` — `AdminUnauthorizedError`
  - `lib/nc-admin-api/auth.ts` — `ensureNcAdminToken`
  - `components/nc-admin/sentry/unavailable-state.tsx` — `UnavailableState`
  - `lib/admin/product.ts` — `useAdminProduct`, `ADMIN_PRODUCTS`
  - `components/nc-admin/product-switch.tsx` — `ProductSwitch`
  - `components/garage-admin/admin-search.tsx` — `useAdminSearch`
- **Packages:**
  - `react` — `useCallback`, `useEffect`, `useMemo`, `useRef`, `useState`
  - `next` — `useRouter`

## Used by

Entry: reached by the Next.js router at `/garage-admin/networkchains/sentry` (page).
