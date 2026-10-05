# `components/data-table/AppliedFilterChips.tsx`

> React component `AppliedFilterChips`.

**Kind:** React component · **Lines:** 68 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `AnimatePresence` (framer-motion), `X` (lucide-react)

### Props

- **`AppliedFilterChips`**: `chips: FilterChip[]`, `onClearAll?: () => void`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `FilterChip` | interface | One active filter criterion, rendered as a removable chip above the table. | 11 |
| `AppliedFilterChips` | component | `AppliedFilterChips({ chips, onClearAll, }: { chips: FilterChip[]; onClearAll?:…)` — Shared applied-filter chip bar. | 21 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/data-table/motion.ts` — `DUR`, `EASE`
- **Packages:**
  - `framer-motion` — `motion`, `AnimatePresence`
  - `lucide-react` — `X`

## Used by

- `app/garage-admin/(admin-dashboard)/networkchains/axons/page.tsx`
- `app/garage-admin/(admin-dashboard)/networkchains/earngpt-learning/page.tsx`
- `app/garage-admin/(admin-dashboard)/networkchains/offerings/page.tsx`
- `app/garage-admin/(admin-dashboard)/networkchains/sentry/page.tsx`
- `app/garage-admin/(admin-dashboard)/networkchains/subscriptions/page.tsx`
