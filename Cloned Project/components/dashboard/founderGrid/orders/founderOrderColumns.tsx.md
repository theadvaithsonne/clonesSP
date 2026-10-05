# `components/dashboard/founderGrid/orders/founderOrderColumns.tsx`

> The columns of the founder Orders grid.

**Kind:** React component · **Lines:** 299 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The columns of the founder Orders grid.

One definition serving every item type the `/feed/founder/invoices`
endpoint supports — the only thing that varies per type is the header of
the item column ("Community", "Digital Product", …), passed in.

TWO COLUMN SETS, TWO ROW TYPES
  Invoices   one row per invoice — who bought, which community, how much,
             what state the payment is in.
  Users      one row per buyer — the same money rolled up per customer.

NO SELECTION COLUMN. Unlike the Live Streams grid (where the tick is the
Options control) a row here has exactly one action — open the invoice — so
there is nothing a checkbox could mean. `FounderOrdersTable`
deliberately does not pass `selectable`, which makes Invoice Number the
literal left edge of the grid. […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Bar`×10 (components/dashboard/founderGrid/orders/founderOrderCells.tsx), `StackSkeleton`×3 (local), `PillSkeleton`×3 (local), `PersonSkeleton`×2 (local), `CustomerCell`×2 (components/dashboard/founderGrid/orders/founderOrderCells.tsx), `InvoiceNumberCell` (components/dashboard/founderGrid/orders/founderOrderCells.tsx), `ItemCell` (components/dashboard/founderGrid/orders/founderOrderCells.tsx), `TypeCell` (components/dashboard/founderGrid/orders/founderOrderCells.tsx), `AmountCell` (components/dashboard/founderGrid/orders/founderOrderCells.tsx), `InvoiceStatusBadge` (components/dashboard/founderGrid/orders/founderOrderCells.tsx), `CreatedCell` (components/dashboard/founderGrid/orders/founderOrderCells.tsx), `Link` (next/link), `ExternalLink` (lucide-react), `UsersIcon` (lucide-react), `UserStatusBadge` (components/dashboard/founderGrid/orders/founderOrderCells.tsx)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `buildFounderOrderColumns` | function | `buildFounderOrderColumns({ itemLabel, }: { /** Singular name of what was bought — he…): ColumnDef<FounderChannelInvoiceRow>[]` | 95 |
| `buildFounderCustomerColumns` | function | `buildFounderCustomerColumns({ itemLabelPlural, }: { /** Plural name of what was bought …): ColumnDef<FounderItemUserRow>[]` | 202 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/data-table/types.ts` — `ColumnDef`, `(types only)`
  - `lib/feed-api.ts` — `FounderChannelInvoiceRow`, `FounderItemUserRow`, `(types only)`
  - `components/dashboard/founderGrid/orders/founderOrderCells.tsx` — `AmountCell`, `Bar`, `CreatedCell`, `CustomerCell`, `InvoiceNumberCell`, `InvoiceStatusBadge`, `ItemCell`, `TypeCell`, … +3
- **Packages:**
  - `next`
  - `lucide-react` — `ExternalLink`, `Users as UsersIcon`

## Used by

- `components/dashboard/founderGrid/orders/FounderOrdersTable.tsx`
