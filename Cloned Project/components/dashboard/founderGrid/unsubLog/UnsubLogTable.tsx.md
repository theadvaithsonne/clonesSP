# `components/dashboard/founderGrid/unsubLog/UnsubLogTable.tsx`

> Founder console → Unsub Log, as a Bigin-style data grid.

**Kind:** React component · **Lines:** 509 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
Founder console → Unsub Log, as a Bigin-style data grid.

Read-only log of every membership event across one item kind. The parent
pins the kind, so this renders at Communities → Unsub Log, Live Streams →
Unsub Log and Courses → Unsub Log from one component.

Data sources, unchanged from the layout this replaces:
  channel / workshop  GET /feed/founder/unsub-log — written by
                      services/feed.ts:unsubscribeFromChannel (all three
                      cancel branches write an "unsubscribed" event) and by
                      the sweeper in index.ts, which flips "cancelling this
                      cycle" members to inactive at nextPaymentDate and
                      writes an "expired" event.
  product             GET /feed/founder/product-refunds — products have no
                      subscription to cancel, so the page shows refunded +
                      cancelled orders instead, shape-matched to the same […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Gold`×3 (components/dashboard/founderGrid/chrome.tsx), `Green` (components/dashboard/founderGrid/chrome.tsx), `DataTable` (components/data-table/DataTable.tsx), `GridEmptyState` (components/dashboard/founderGrid/chrome.tsx), `TopBarShell` (components/dashboard/founderGrid/chrome.tsx), `TopBarRow` (components/dashboard/founderGrid/chrome.tsx), `FilterToggleButton` (components/dashboard/founderGrid/chrome.tsx), `ItemPicker` (components/dashboard/founderGrid/chrome.tsx), `TopBarActions` (components/dashboard/founderGrid/chrome.tsx), `SearchBox` (components/dashboard/founderGrid/chrome.tsx), `FilterTray` (components/dashboard/founderGrid/chrome.tsx), `FilterGroup` (components/dashboard/founderGrid/chrome.tsx), `DateRangeFilter` (components/dashboard/founderGrid/chrome.tsx), `ClearAllButton` (components/dashboard/founderGrid/chrome.tsx)

### Props

- **`UnsubLogTable`**: `itemKind: FounderUnsubLogKind`, `itemLabel: string`, `itemLabelPlural: string`

**Hooks used:** `useState`×11, `useEffect`×4, `useMemo`×4, `useCallback`×2

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `FounderUnsubLogKind` | type | Kind is pinned by the parent — one Unsub page per item type. | 100 |
| `UnsubLogTableProps` | interface |  | 102 |
| `UnsubLogTable` | component | `UnsubLogTable({ itemKind, itemLabel, itemLabelPlural, }: UnsubLogTablePro…)` | 110 |

## Interfaces

- **Timers / queues:** `setTimeout` at L137

## Dependencies

- **Internal:**
  - `components/data-table/DataTable.tsx` — `DataTable`
  - `lib/feed-api.ts` — `getFounderUnsubLog`, `FounderUnsubLogCounts`, `FounderUnsubLogFilters`, `FounderUnsubLogRow`, `FounderUnsubLogWorkshopOption`, `UnsubEventType`, `UnsubItemKind`
  - `components/dashboard/founderGrid/unsubLog/unsubLogColumns.tsx` — `buildUnsubLogColumns`
  - `components/dashboard/founderGrid/unsubLog/unsubLogCells.tsx` — `formatLtv`
  - `components/dashboard/founderGrid/tokens.ts` — `GRID_BG`, `ROW_H`, `SHELL_BORDER`, `SHELL_FOOTER_H`
  - `components/dashboard/founderGrid/chrome.tsx` — `ANY`, `ClearAllButton`, `DateRangeFilter`, `FilterGroup`, `FilterToggleButton`, `FilterTray`, `Gold`, `Green`, … +9
- **Packages:**
  - `react` — `useCallback`, `useEffect`, `useMemo`, `useState`
  - `sonner` — `toast`

## Used by

- `components/dashboard/FounderUnsubLogPage.tsx`
