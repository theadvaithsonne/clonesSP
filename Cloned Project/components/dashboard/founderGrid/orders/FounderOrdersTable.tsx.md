# `components/dashboard/founderGrid/orders/FounderOrdersTable.tsx`

> Founder console → Orders, as a Bigin-style data grid.

**Kind:** React component · **Lines:** 937 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
Founder console → Orders, as a Bigin-style data grid.

ONE component for every item type the endpoint serves. Mounted today at
Communities → Orders, Digital Products → Orders, Digital Products →
Customers and Courses → Orders; `itemType` is the only difference between
them. (Live Streams → Orders still uses the older shared
`FounderInvoicesPage`.)

Replaces the 240px-sidebar + card-panel layout with the same shell the
founder Live Streams grid uses: a horizontal top bar, an expandable filter
tray, one full-bleed `DataTable`, and a 44px footer status strip. Nothing
about the DATA changed — both views still read
`GET /feed/founder/invoices` and `GET /feed/founder/item-users`.

NO SELECTION COLUMN. `selectable` is deliberately not passed to DataTable:
a row here has exactly one action (open the invoice / open the customer […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Gold`×4 (components/dashboard/founderGrid/chrome.tsx), `FilterGroup`×4 (components/dashboard/founderGrid/chrome.tsx), `Green`×2 (components/dashboard/founderGrid/chrome.tsx), `DataTable`×2 (components/data-table/DataTable.tsx), `ViewTab`×2 (components/dashboard/founderGrid/chrome.tsx), `TopBar` (local), `GridEmptyState` (components/dashboard/founderGrid/chrome.tsx), `UserActivityOverlay` (components/dashboard/UserActivityOverlay.tsx), `TopBarShell` (components/dashboard/founderGrid/chrome.tsx), `TopBarRow` (components/dashboard/founderGrid/chrome.tsx), `FilterToggleButton` (components/dashboard/founderGrid/chrome.tsx), `ViewTabBar` (components/dashboard/founderGrid/chrome.tsx), `FileText` (lucide-react), `UsersIcon` (lucide-react), `ItemPicker` (components/dashboard/founderGrid/chrome.tsx), `TopBarActions` (components/dashboard/founderGrid/chrome.tsx), `SearchBox` (components/dashboard/founderGrid/chrome.tsx), `ExportCsvButton` (components/dashboard/founderGrid/chrome.tsx), `FilterTray` (components/dashboard/founderGrid/chrome.tsx), `DateRangeFilter` (components/dashboard/founderGrid/chrome.tsx), `ClearAllButton` (components/dashboard/founderGrid/chrome.tsx)

### Props

- **`FounderOrdersTable`**: `itemType: FounderInvoiceItemType`, `itemLabel: string`, `itemLabelPlural: string`, `initialView?: View`, `hideViewSwitch?: boolean`

**Hooks used:** `useState`×18, `useEffect`×7, `useMemo`×7, `useCallback`×4

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `FounderOrdersTableProps` | interface |  | 191 |
| `FounderOrdersTable` | component | `FounderOrdersTable({ itemType, itemLabel, itemLabelPlural, initialView = "invo…)` | 210 |

## Interfaces

- **Timers / queues:** `setTimeout` at L253, L260

## Dependencies

- **Internal:**
  - `components/data-table/DataTable.tsx` — `DataTable`
  - `lib/csvExport.ts` — `exportRowsAsCsv`
  - `lib/feed-api.ts` — `getFounderInvoices`, `getFounderItemUsers`, `ChannelInvoiceStatus`, `FounderChannelInvoiceRow`, `FounderInvoicesFilters`, `FounderItemUserRow`, `FounderItemUserStatus`, `FounderItemUsersFilters`
  - `lib/feed-api.ts` — `FounderInvoiceItemType`, `(types only)`
  - `components/dashboard/UserActivityOverlay.tsx` — `UserActivityOverlay`
  - `components/dashboard/founderGrid/orders/founderOrderColumns.tsx` — `buildFounderCustomerColumns`, `buildFounderOrderColumns`
  - `components/dashboard/founderGrid/orders/founderOrderCells.tsx` — `formatDateTime`, `sumByCurrency`
  - `components/dashboard/founderGrid/tokens.ts` — `GRID_BG`, `ROW_H`, `SHELL_BORDER`, `SHELL_FOOTER_H`
  - `components/dashboard/founderGrid/chrome.tsx` — `ANY`, `ClearAllButton`, `DateRangeFilter`, `ExportCsvButton`, `FilterGroup`, `FilterToggleButton`, `FilterTray`, `Gold`, … +11
- **Packages:**
  - `react` — `useCallback`, `useEffect`, `useMemo`, `useState`
  - `lucide-react` — `FileText`, `Users as UsersIcon`
  - `sonner` — `toast`

## Used by

- `components/dashboard/FounderCommunityOrdersPage.tsx`
- `components/dashboard/FounderCourseOrdersPage.tsx`
- `components/dashboard/FounderLiveOrdersPage.tsx`
- `components/dashboard/FounderProductCustomersPage.tsx`
- `components/dashboard/FounderProductOrdersPage.tsx`
