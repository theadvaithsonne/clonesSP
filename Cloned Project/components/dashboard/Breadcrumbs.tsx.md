# `components/dashboard/Breadcrumbs.tsx`

> React component `Breadcrumbs`.

**Kind:** React component · **Lines:** 199 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `React` (react), `ChevronRight` (lucide-react), `MoreHorizontal` (lucide-react)

### Props

- **`Breadcrumbs`**: `activeTab: string | null`, `tabTrail?: string[]`, `onSelectTab: (tab: string) => void`, `onCloseAll: () => void`, `dynamicItems?: { label: string; key?: string }[]`, `onDynamicItemClick?: (item: { label: string; key?: string }, index: n…`

**Hooks used:** `useState`×2, `useEffect`×2, `useRef`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `Breadcrumbs` | component | `Breadcrumbs({ activeTab, tabTrail = [], onSelectTab, onCloseAll, dynami…)` | 25 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/utils.ts` — `cn`
- **Packages:**
  - `react` — `useState`, `useEffect`, `useRef`
  - `react-dom` — `createPortal`
  - `lucide-react` — `ChevronRight`, `MoreHorizontal`

## Used by

No other file imports this one and it has no automatic entry point — it appears unused (or is loaded dynamically by a path the import graph cannot see).
