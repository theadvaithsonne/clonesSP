# `components/deals/companies/CompaniesDataTable.tsx`

> React component `CompaniesDataTable`.

**Kind:** React component · **Lines:** 226 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Dash`×4 (components/ui/data-table/cells.tsx), `Avatar` (components/ui/data-table/cells.tsx), `PersonBlock` (components/ui/data-table/cells.tsx), `DataTable` (components/ui/data-table/DataTable.tsx)

### Props

- **`CompaniesDataTable`**: `rows: any[]`, `loading?: boolean`, `emptyLabel?: string`, `sort: SortState | null`, `onSortChange: (next: SortState) => void`, `getRowId: (company: any) => string`, `onRowClick: (company: any) => void`, `selectedIds: Set<string>`, `allSelected: boolean`, `someSelected: boolean`, `onToggleRow: (id: string) => void`, `onToggleAll: () => void`, `getCompanyName: (company: any) => string`, `getWebsite: (company: any) => string`, `getIndustry: (company: any) => string`, `getSize: (company: any) => string`, `getOwner: (company: any) => CompanyOwner`, `getOpenLeads: (company: any) => number`, `getWonDeals: (company: any) => number`, `getLastActivity: (company: any) => string`, `renderActions: (company: any) => ReactNode`, `footerTotals?: DataTableTotal[]`, `pagination?: PaginationProps`

**Hooks used:** `useMemo`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `CompanyOwner` | type |  | 13 |
| `CompaniesDataTableProps` | type |  | 15 |
| `CompaniesDataTable` | component | `CompaniesDataTable(props: CompaniesDataTableProps)` | 48 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/ui/data-table/DataTable.tsx` — `DataTable`
  - `components/ui/data-table/cells.tsx` — `Avatar`, `Dash`, `PersonBlock`
  - `components/ui/data-table/types.ts` — `ColumnDef`, `DataTableTotal`, `PaginationProps`, `SortState`, `(types only)`
- **Packages:**
  - `react` — `useMemo`, `ReactNode`

## Used by

- `app/(dashboard)/deals/companies/page.tsx`
