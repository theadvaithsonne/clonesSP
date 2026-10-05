# `components/dashboard/RecentTabs.tsx`

> React component `RecentTabs`.

**Kind:** React component · **Lines:** 81 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `AnimatePresence` (framer-motion), `X` (lucide-react)

### Props

- **`RecentTabs`**: `tabs: string[]`, `activeTab: string | null`, `getTabLabel?: (tab: string) => string`, `onSelect: (tab: string) => void`, `onClose: (tab: string) => void`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `RecentTabs` | component | `React.memo(function RecentTabs({ tabs, activeTab, getTabLabel, onSelect, onClose, }: Rece…` | 17 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/utils.ts` — `cn`
- **Packages:**
  - `react`
  - `lucide-react` — `X`
  - `framer-motion` — `motion`, `AnimatePresence`

## Used by

- `app/(dashboard)/layout.tsx`
