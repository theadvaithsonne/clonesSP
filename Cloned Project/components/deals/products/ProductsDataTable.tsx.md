# `components/deals/products/ProductsDataTable.tsx`

> React component `ProductsDataTable`.

**Kind:** React component · **Lines:** 246 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Dash`×4 (components/ui/data-table/cells.tsx), `Briefcase` (lucide-react), `Package` (lucide-react), `DataTable` (components/ui/data-table/DataTable.tsx)

### Props

- **`ProductsDataTable`**: `rows: any[]`, `loading?: boolean`, `emptyLabel?: string`, `sort: SortState | null`, `onSortChange: (next: SortState) => void`, `getRowId: (product: any) => string`, `onRowClick: (product: any) => void`, `selectedIds: Set<string>`, `allSelected: boolean`, `someSelected: boolean`, `onToggleRow: (id: string) => void`, `onToggleAll: () => void`, `getProductName: (product: any) => string`, `isService: (product: any) => boolean`, `getCode: (product: any) => string`, `getCategory: (product: any) => string`, `getPrice: (product: any) => string`, `getStatus: (product: any) => string`, `getUpdated: (product: any) => string`, `renderActions: (product: any) => ReactNode`, `footerTotals?: DataTableTotal[]`, `pagination?: PaginationProps`

**Hooks used:** `useMemo`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `ProductsDataTableProps` | type |  | 14 |
| `ProductsDataTable` | component | `ProductsDataTable(props: ProductsDataTableProps)` | 46 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/ui/data-table/DataTable.tsx` — `DataTable`
  - `components/ui/data-table/cells.tsx` — `Dash`
  - `components/ui/data-table/types.ts` — `ColumnDef`, `DataTableTotal`, `PaginationProps`, `SortState`, `(types only)`
- **Packages:**
  - `react` — `useMemo`, `ReactNode`
  - `lucide-react` — `Briefcase`, `Package`

## Used by

- `app/(dashboard)/deals/products/page.tsx`
