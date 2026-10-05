# `components/garage-admin/DailyReportsFilterDrawer.tsx`

> Filter drawer for the Daily Reports table.

**Kind:** React component · **Lines:** 378 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
Filter drawer for the Daily Reports table. Same shell as
NetworkChainSubsFilterDrawer (field list → per-field screen), with:
  - Date range: presets on IST calendar days + a real two-month range
    calendar (components/ui/range-calendar) instead of native date inputs.
    The page always has a range; "Reset" returns to the default window
    (yesterday → today, IST) rather than clearing it.
  - Kind: Founders Office / Unilevel Plus / Crypto white-label.
Backend contract: `?from=YYYY-MM-DD&to=YYYY-MM-DD&kind=office|unilevel|whitelabel`.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `GoldCheck`×3 (local), `AnimatePresence` (framer-motion), `ArrowLeft` (lucide-react), `X` (lucide-react), `FieldList` (local), `RangeScreen` (local), `KindScreen` (local), `DownlineScreen` (components/garage-admin/downline-scope.tsx), `Icon` (local), `ChevronRight` (lucide-react), `Check` (lucide-react), `RangeCalendar` (components/ui/range-calendar.tsx)

### Props

- **`DailyReportsFilterDrawer`**: `open: boolean`, `onClose: () => void`, `filters: DailyReportsFilters`, `onApply: (next: DailyReportsFilters) => void`

**Hooks used:** `useState`×3, `useEffect`×2

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `DailyReportsFilters` | export |  | 29 |
| `DailyReportsFilterDrawer` | component | `DailyReportsFilterDrawer({ open, onClose, filters, onApply, }: { open: boolean; onCl…)` | 33 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/ui/range-calendar.tsx` — `RangeCalendar`
  - `components/garage-admin/downline-scope.tsx` — `DownlineScreen`
  - `lib/admin-api/daily-reports.ts` — `RANGE_PRESETS`, `KIND_LABEL`, `defaultRange`, `istToday`, `presetForRange`, `rangeSummary`, `DailyReportKind`, `DailyReportsFilters`
- **Packages:**
  - `react` — `useEffect`, `useState`
  - `react-dom` — `createPortal`
  - `framer-motion` — `AnimatePresence`, `motion`
  - `lucide-react` — `ArrowLeft`, `Calendar`, `ChevronRight`, `Check`, `Layers`, `Users`, …

## Used by

- `app/garage-admin/(admin-dashboard)/daily-reports/page.tsx`
