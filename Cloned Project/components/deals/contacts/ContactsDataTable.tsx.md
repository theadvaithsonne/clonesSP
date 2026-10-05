# `components/deals/contacts/ContactsDataTable.tsx`

> React component `ContactsDataTable`.

**Kind:** React component · **Lines:** 184 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `TextCell`×4 (local), `Dash`×2 (components/ui/data-table/cells.tsx), `Avatar` (components/ui/data-table/cells.tsx), `DataTable` (components/ui/data-table/DataTable.tsx)

### Props

- **`ContactsDataTable`**: `rows: any[]`, `loading?: boolean`, `emptyLabel?: string`, `sort: SortState | null`, `onSortChange: (next: SortState) => void`, `getRowId: (contact: any) => string`, `onRowClick: (contact: any) => void`, `selectedIds: Set<string>`, `allSelected: boolean`, `someSelected: boolean`, `onToggleRow: (id: string) => void`, `onToggleAll: () => void`, `getContactName: (contact: any) => string`, `getRole: (contact: any) => string`, `getEmail: (contact: any) => string`, `getPhone: (contact: any) => string`, `getCompany: (contact: any) => string`, `getLastActivity: (contact: any) => string`, `renderActions: (contact: any) => ReactNode`, `footerTotals?: DataTableTotal[]`, `pagination?: PaginationProps`

**Hooks used:** `useMemo`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `ContactsDataTableProps` | type |  | 13 |
| `ContactsDataTable` | component | `ContactsDataTable(props: ContactsDataTableProps)` | 57 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/ui/data-table/DataTable.tsx` — `DataTable`
  - `components/ui/data-table/cells.tsx` — `Avatar`, `Dash`
  - `components/ui/data-table/types.ts` — `ColumnDef`, `DataTableTotal`, `PaginationProps`, `SortState`, `(types only)`
- **Packages:**
  - `react` — `useMemo`, `ReactNode`

## Used by

- `app/(dashboard)/deals/contacts/page.tsx`
