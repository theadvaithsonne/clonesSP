# `components/deals/leads/LeadsDataTable.tsx`

> React component `LeadsDataTable`.

**Kind:** React component · **Lines:** 225 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Dash`×4 (components/ui/data-table/cells.tsx), `Avatar` (components/ui/data-table/cells.tsx), `PersonBlock` (components/ui/data-table/cells.tsx), `DataTable` (components/ui/data-table/DataTable.tsx)

### Props

- **`LeadsDataTable`**: `rows: any[]`, `loading?: boolean`, `emptyLabel?: string`, `sort: SortState | null`, `onSortChange: (next: SortState) => void`, `getRowId: (lead: any) => string`, `onRowClick: (lead: any) => void`, `selectedIds: Set<string>`, `allSelected: boolean`, `someSelected: boolean`, `onToggleRow: (id: string) => void`, `onToggleAll: () => void`, `getLeadName: (lead: any) => string`, `getOwner: (lead: any) => LeadOwner`, `getStage: (lead: any) => string`, `getValue: (lead: any) => number`, `formatValue: (n: number) => string`, `getNextFollowUp: (lead: any) => string`, `getEmail: (lead: any) => string`, `renderTags: (lead: any) => ReactNode`, `renderActions: (lead: any) => ReactNode`, `footerTotals?: DataTableTotal[]`, `pagination?: PaginationProps`

**Hooks used:** `useMemo`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `LeadOwner` | type |  | 17 |
| `LeadsDataTableProps` | type |  | 19 |
| `LeadsDataTable` | component | `LeadsDataTable(props: LeadsDataTableProps)` | 52 |

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

- `app/(dashboard)/deals/leads/page.tsx`
