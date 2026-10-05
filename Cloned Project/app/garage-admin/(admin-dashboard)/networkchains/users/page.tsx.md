# `app/garage-admin/(admin-dashboard)/networkchains/users/page.tsx`

> Next.js page rendered at `/garage-admin/networkchains/users`.

**Kind:** Next.js page · **Lines:** 251 · **Directive:** `"use client"` · **Route:** `/garage-admin/networkchains/users` (page)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Avatar` (local), `DataTable` (components/data-table/DataTable.tsx), `TableTopBar` (components/data-table/TableTopBar.tsx), `ExportButton` (components/data-table/ExportPanel.tsx), `ExportPanel` (components/data-table/ExportPanel.tsx)

**Hooks used:** `useState`×11, `useEffect`×3, `useCallback`×2, `useRouter` (next/navigation), `useAdminSearch` (components/garage-admin/admin-search.tsx), `useRef`, `useMemo`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (AdminUsersPage)` | component | `AdminUsersPage()` | 59 |

## Interfaces

- **Timers / queues:** `setTimeout` at L93

## Dependencies

- **Internal:**
  - `components/data-table/DataTable.tsx` — `DataTable`
  - `components/data-table/TableTopBar.tsx` — `TableTopBar`
  - `components/data-table/types.ts` — `ColumnDef`, `SortState`, `(types only)`
  - `components/data-table/ExportPanel.tsx` — `ExportPanel`, `ExportButton`, `ExportField`
  - `lib/nc-admin-api/admin.ts` — `getAdminUsers`, `AdminUnauthorizedError`, `AdminUserRow`
  - `lib/nc-admin-api/auth.ts` — `ensureNcAdminToken`
  - `components/garage-admin/admin-search.tsx` — `useAdminSearch`
- **Packages:**
  - `react` — `useCallback`, `useEffect`, `useMemo`, `useRef`, `useState`
  - `next` — `useRouter`

## Used by

Entry: reached by the Next.js router at `/garage-admin/networkchains/users` (page).
