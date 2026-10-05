# `components/dashboard/founderGrid/chrome.tsx`

> Shared chrome for the founder console's data grids.

**Kind:** React component · **Lines:** 514 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
Shared chrome for the founder console's data grids.

The Orders grid and the Unsub Log grid have the same top bar (filter
toggle, view tabs, item picker, search) and the same expandable filter
tray (segmented pill groups, a date range). Every one of those was
duplicated across the two files before this module existed, which is how
the pill padding on one page ends up 2px off the other after a tweak that
only touched one of them.

Anything here is presentation only — it holds no data and knows nothing
about invoices or unsub events. The tables own their state and pass it in.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `SelectItem`×2 (components/ui/select.tsx), `FilterLabel`×2 (local), `DateInput`×2 (local), `SlidersHorizontal` (lucide-react), `Search` (lucide-react), `X` (lucide-react), `Select` (components/ui/select.tsx), `SelectTrigger` (components/ui/select.tsx), `SelectValue` (components/ui/select.tsx), `SelectContent` (components/ui/select.tsx), `Loader2` (lucide-react), `Download` (lucide-react)

### Props

- **`Gold`**: `children: ReactNode`
- **`Green`**: `children: ReactNode`
- **`TopBarShell`**: `children: ReactNode`
- **`TopBarRow`**: `children: ReactNode`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `ANY` | const | `= "__all__"` — Sentinel for "no filter". | 34 |
| `RPP_OPTIONS` | const | `= [10, 20, 50, 100]` — Page-size choices. Capped at 100 because that's the ceiling both `/feed/founder/invoices` and `/feed/founder/unsub-log` clamp `limit` to. | 38 |
| `readOrgId` | function | `readOrgId(): string \| null` — Read the current org id from where the rest of the dashboard reads it. | 41 |
| `Gold` | component | `Gold({ children }: { children: ReactNode })` — Counts. Gold is the brand accent and marks "how many". | 49 |
| `Green` | component | `Green({ children }: { children: ReactNode })` — Money. Emerald separates "how much" from "how many" at a glance, so a founder never reads a revenue figure as a headcount. | 57 |
| `TopBarShell` | component | `TopBarShell({ children }: { children: ReactNode })` — The outer shell of a grid's top bar: the bottom rule plus the responsive padding both grids use. | 67 |
| `TopBarRow` | component | `TopBarRow({ children }: { children: ReactNode })` — The main row. Two groups that wrap as UNITS rather than one long wrapping row, so at tablet width the search/export pair drops to its own line intact instead of the export button orphaning under the tabs. | 76 |
| `FilterToggleButton` | component | `FilterToggleButton({ open, active, onToggle, }: { open: boolean; /** Any filte…)` | 84 |
| `ViewTab` | component | `ViewTab({ active, onClick, icon, label, }: { active: boolean; onCli…)` — One tab of a segmented view switcher. | 116 |
| `ViewTabBar` | component | `ViewTabBar({ children }: { children: ReactNode })` — The pill bar a `ViewTab` set sits in. | 153 |
| `SearchBox` | component | `SearchBox({ value, onChange, placeholder, }: { value: string; onChang…)` — The top bar's search box. | 168 |
| `TopBarActions` | component | `TopBarActions({ children }: { children: ReactNode })` — Right-hand group of the top bar. | 202 |
| `ItemPickerOption` | interface | One entry of an `ItemPicker`. | 212 |
| `ItemPicker` | component | `ItemPicker({ value, onChange, options, itemLabel, itemLabelPlural, }: …)` — "All communities" / "All digital products" — the scope picker. | 229 |
| `ExportCsvButton` | component | `ExportCsvButton({ exporting, onClick, }: { exporting: boolean; onClick: () …)` | 282 |
| `FilterTray` | component | `FilterTray({ children }: { children: ReactNode })` | 318 |
| `FilterLabel` | component | `FilterLabel({ children }: { children: ReactNode })` — An uppercase caption for a tray control. | 334 |
| `FilterGroup` | component | `FilterGroup({ label, options, value, onChange, }: { label: string; opti…)` — A labelled bar of mutually-exclusive pills. | 343 |
| `DateRangeFilter` | component | `DateRangeFilter({ label, from, to, onFrom, onTo, }: { label: string; from: …)` — A labelled From–To pair. | 382 |
| `ClearAllButton` | component | `ClearAllButton({ onClick }: { onClick: () => void })` — "Clear all" — only worth rendering when something is actually filtered. | 434 |
| `GridEmptyState` | component | `GridEmptyState({ title, detail, onClearFilters, }: { title: string; /** Op…)` — The "nothing to show" block, for `DataTable`'s `emptyLabel`. | 456 |
| `GridPageShell` | component | `GridPageShell({ children }: { children: ReactNode })` — The wrapper every founder grid page mounts its table in. | 507 |

## Interfaces

- **Browser storage / cookies:** `garage_org_id` (localStorage: get)

## Dependencies

- **Internal:**
  - `components/ui/select.tsx` — `Select`, `SelectContent`, `SelectItem`, `SelectTrigger`, `SelectValue`
  - `components/dashboard/founderGrid/tokens.ts` — `GLASS_STYLE`, `SHELL_BORDER`
- **Packages:**
  - `react` — `ReactNode`
  - `lucide-react` — `Download`, `Loader2`, `Search`, `SlidersHorizontal`, `X`

## Used by

- `components/dashboard/FounderCommunityOrdersPage.tsx`
- `components/dashboard/FounderCourseOrdersPage.tsx`
- `components/dashboard/FounderLiveOrdersPage.tsx`
- `components/dashboard/FounderProductCustomersPage.tsx`
- `components/dashboard/FounderProductOrdersPage.tsx`
- `components/dashboard/FounderUnsubLogPage.tsx`
- `components/dashboard/founderGrid/orders/FounderOrdersTable.tsx`
- `components/dashboard/founderGrid/unsubLog/UnsubLogTable.tsx`
