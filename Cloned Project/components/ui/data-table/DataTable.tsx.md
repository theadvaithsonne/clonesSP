# `components/ui/data-table/DataTable.tsx`

> React component `DataTable`.

**Kind:** UI primitive (shadcn/Radix wrapper) · **Lines:** 628 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Check`×2 (local), `ArrowUp` (lucide-react), `ArrowDown` (lucide-react), `ArrowUpDown` (lucide-react), `SkeletonRows` (local), `DataRow` (local), `Footer` (local), `ChevronLeft` (lucide-react), `ChevronRight` (lucide-react)

### Props

- **`DataTable`**: `props: DataTableProps<T>`

**Hooks used:** `useMemo`×5, `useState`×5, `useCallback`×4, `useRef`×3, `useEffect`×2, `usePersistentLayout` (local)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `DataTable` | component | `DataTable({ tableId, columns, rows, getRowId, loading, emptyLabel = "…)` | 110 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/ui/data-table/motion.ts` — `DUR`, `EASE`, `T`, `cssEase`
  - `components/ui/data-table/types.ts` — `ColumnDef`, `DataTableProps`, `SortOrder`, `(types only)`
- **Packages:**
  - `react` — `memo`, `useCallback`, `useEffect`, `useMemo`, `useRef`, `useState`
  - `lucide-react` — `ArrowDown`, `ArrowUp`, `ArrowUpDown`, `ChevronLeft`, `ChevronRight`

## Used by

- `components/dashboard/docusign/analytics/RecentDocumentsTable.tsx`
- `components/deals/companies/CompaniesDataTable.tsx`
- `components/deals/contacts/ContactsDataTable.tsx`
- `components/deals/funnel/FunnelsDataTable.tsx`
- `components/deals/leads/LeadsDataTable.tsx`
- `components/deals/products/ProductsDataTable.tsx`
