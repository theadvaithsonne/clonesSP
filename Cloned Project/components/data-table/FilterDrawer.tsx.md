# `components/data-table/FilterDrawer.tsx`

> React components `FilterDrawer`, `NumberBadge`, `ValueRow`, `FilterCard` and 1 more.

**Kind:** React component · **Lines:** 546 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `AnimatePresence`×3 (framer-motion), `NumberBadge`×3 (local), `ValueRow`×3 (local), `Search`×2 (lucide-react), `X`×2 (lucide-react), `Check`×2 (lucide-react), `FilterCard`×2 (local), `ArrowLeft` (lucide-react), `Icon` (local), `ChevronRight` (lucide-react), `NoMatch` (local), `Calendar` (lucide-react)

### Props

- **`FilterDrawer`**: `open: boolean`, `onClose: () => void`, `title?: string`, `fields: FilterField<D>[]`, `value: D`, `onApply: (d: D) => void`
- **`NumberBadge`**: `n: number | string`, `gold?: boolean`
- **`ValueRow`**: `badge?: React.ReactNode`, `title: string`, `sub?: string`, `selected?: boolean`, `first?: boolean`, `onClick: () => void`
- **`FilterCard`**: `children: React.ReactNode`

**Hooks used:** `useState`×5, `useEffect`×2

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `FilterField` | interface | The shared, Bigin-style typed filter drawer — generalized from the downline drawer. | 20 |
| `FilterDrawer` | component | `FilterDrawer({ open, onClose, title = "Filters", fields, value, onApply,…)` | 40 |
| `NumberBadge` | component | `NumberBadge({ n, gold }: { n: number \| string; gold?: boolean })` | 268 |
| `ValueRow` | component | `ValueRow({ badge, title, sub, selected, first, onClick, }: { badge?:…)` | 282 |
| `FilterCard` | component | `FilterCard({ children }: { children: React.ReactNode })` | 314 |
| `NoMatch` | component | `NoMatch()` | 322 |
| `FacetOption` | interface |  | 328 |
| `facetField` | function | `facetField(cfg: { id: string; label: string; icon?: React.ComponentTyp…): FilterField<D>` — A categorical facet field (single- or multi-select) with a value+count list — the downline "Level/Location/Type" pattern, generalized. | 337 |
| `numericRangeField` | function | `numericRangeField(cfg: { id: string; label: string; icon?: React.ComponentTyp…): FilterField<D>` — A numeric min/max range field (e.g. | 418 |
| `DATE_PRESETS` | const | `= [ { label: "All dates", days: null }, { label: "Last 7 days", days: 7 }, { label: "Last…` | 486 |
| `dateRangeField` | function | `dateRangeField(cfg: { id: string; label: string; icon?: React.ComponentTyp…): FilterField<D>` — A date-range field driven by relative presets (Bigin's "Last N days"). | 495 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/data-table/motion.ts` — `DUR`, `EASE`, `SPRING`
- **Packages:**
  - `react` — `useEffect`, `useState`
  - `react-dom` — `createPortal`
  - `framer-motion` — `motion`, `AnimatePresence`
  - `lucide-react` — `ArrowLeft`, `Calendar`, `Check`, `ChevronRight`, `Search`, `X`

## Used by

- `app/garage-admin/(admin-dashboard)/networkchains/subscriptions/page.tsx`
