# `components/garage-admin/NetworkChainSubsFilterDrawer.tsx`

> Filter drawer for the NetworkChain Subs table.

**Kind:** React component · **Lines:** 340 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
Filter drawer for the NetworkChain Subs table. Modeled on NC's
DownlineFilterDrawer (field-list → per-field screen morph) but scoped to
the one filter the admin cares about today:
  - Started: date-range preset OR custom from/to
There is no status filter: the table is active subscriptions only (the
backend enforces it), so there is nothing to choose between.
Backend contract: `?startedFrom=YYYY-MM-DD&startedTo=YYYY-MM-DD`.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `AnimatePresence` (framer-motion), `ArrowLeft` (lucide-react), `X` (lucide-react), `FieldList` (local), `StartedScreen` (local), `Icon` (local), `ChevronRight` (lucide-react)

### Props

- **`NetworkChainSubsFilterDrawer`**: `open: boolean`, `onClose: () => void`, `filters: NcSubsFilters`, `onApply: (f: NcSubsFilters) => void`

**Hooks used:** `useState`×3, `useEffect`×2

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `SubStatus` | type |  | 24 |
| `NcSubsFilters` | interface |  | 25 |
| `NetworkChainSubsFilterDrawer` | component | `NetworkChainSubsFilterDrawer({ open, onClose, filters, onApply, }: { open: boolean; onCl…)` | 40 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:** none
- **Packages:**
  - `react` — `useEffect`, `useState`
  - `react-dom` — `createPortal`
  - `framer-motion` — `AnimatePresence`, `motion`
  - `lucide-react` — `ArrowLeft`, `Calendar`, `CheckCircle2`, `ChevronRight`, `Hourglass`, `Trash2`, …

## Used by

- `app/garage-admin/(admin-dashboard)/networkchain-subs/page.tsx`
