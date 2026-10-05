# `components/offices/OfficeSearchPalette.tsx`

> React component `OfficeSearchPalette`.

**Kind:** React component · **Lines:** 237 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `SkeletonBar`×3 (components/offices/OfficesSkeletons.tsx), `Search` (lucide-react), `Loader2` (lucide-react), `OfficeEmblem` (components/offices/ui.tsx), `ArrowUpRight` (lucide-react)

### Props

- **`OfficeSearchPalette`**: `query: string`, `onQueryChange: (q: string) => void`, `onClose: () => void`, `categories: DiscoverCategory[]`, `onOpenOffice: (office: DiscoverOffice) => void`, `onSubmit: (q: string) => void`, `onSelectCategory: (category: string) => void`

**Hooks used:** `useState`×5, `useEffect`×2, `useRef`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `shortcutLabel` | function | `shortcutLabel()` | 17 |
| `OfficeSearchPalette` | component | `OfficeSearchPalette({ query, onQueryChange, onClose, categories, onOpenOffice, …)` — The ⌘K panel under the top bar: top matching offices as you type, arrow keys to move, Enter to open. | 26 |

## Interfaces

- **Timers / queues:** `setTimeout` at L67

## Dependencies

- **Internal:**
  - `lib/utils.ts` — `cn`
  - `lib/discover-api.ts` — `fetchDiscoverOffices`, `DiscoverCategory`, `DiscoverOffice`
  - `components/offices/OfficesSkeletons.tsx` — `SkeletonBar`
  - `components/offices/ui.tsx` — `OfficeEmblem`, `formatCount`
- **Packages:**
  - `react` — `useEffect`, `useRef`, `useState`
  - `lucide-react` — `ArrowUpRight`, `Loader2`, `Search`

## Used by

- `components/offices/OfficesTopBar.tsx`
