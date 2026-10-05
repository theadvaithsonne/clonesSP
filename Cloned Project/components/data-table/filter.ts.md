# `components/data-table/filter.ts`

> Module exporting `applyColumnFilters`, `activeFilterCount`.

**Kind:** React component · **Lines:** 44

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `applyColumnFilters` | function | `applyColumnFilters(rows: T[], columns: ColumnDef<T>[], filters: Record<string, string>): T[]` — Apply the table's column filters to a row set. | 16 |
| `activeFilterCount` | function | `activeFilterCount(filters: Record<string, string>): number` — How many filters are actually doing something — drives the "Clear" chip. | 41 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/data-table/types.ts` — `ColumnDef`, `(types only)`
- **Packages:** none

## Used by

- `app/garage-admin/(admin-dashboard)/affiliate-guests/page.tsx`
- `app/garage-admin/(admin-dashboard)/companies/page.tsx`
- `app/garage-admin/(admin-dashboard)/founders/page.tsx`
