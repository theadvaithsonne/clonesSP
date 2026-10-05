# `components/offices/CategoryNav.tsx`

> React components `CategoryRail`, `CategoryTilesSkeleton`, `CategoryTiles`.

**Kind:** React component · **Lines:** 307 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Icon`×4 (local), `Chip`×4 (local), `SkeletonBar`×3 (components/offices/OfficesSkeletons.tsx), `MoreChip`×2 (local), `ChevronDown` (lucide-react), `ChipRowSkeleton` (components/offices/OfficesSkeletons.tsx), `DropdownMenu` (components/ui/dropdown-menu.tsx), `DropdownMenuTrigger` (components/ui/dropdown-menu.tsx), `DropdownMenuContent` (components/ui/dropdown-menu.tsx), `DropdownMenuItem` (components/ui/dropdown-menu.tsx)

### Props

- **`CategoryRail`**: `categories: DiscoverCategory[]`, `selected: string | null`, `onSelect: (category: string | null) => void`, `loading?: boolean`
- **`CategoryTiles`**: `categories: DiscoverCategory[]`, `onSelect: (category: string) => void`, `compact?: boolean`

**Hooks used:** `useRef`×2, `useState`, `useLayoutEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `CategoryRail` | component | `CategoryRail({ categories, selected, onSelect, loading, }: { categories:…)` — "All offices" plus as many categories (most used first) as fit the row at the current width; the rest sit behind "More". | 120 |
| `CategoryTilesSkeleton` | component | `CategoryTilesSkeleton()` | 243 |
| `CategoryTiles` | component | `CategoryTiles({ categories, onSelect, compact, }: { categories: DiscoverC…)` — "Browse by category": one tile per category with its office count. | 263 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/utils.ts` — `cn`
  - `components/ui/dropdown-menu.tsx` — `DropdownMenu`, `DropdownMenuContent`, `DropdownMenuItem`, `DropdownMenuTrigger`
  - `lib/discover-api.ts` — `DiscoverCategory`, `(types only)`
  - `components/offices/OfficesSkeletons.tsx` — `ChipRowSkeleton`, `SkeletonBar`
- **Packages:**
  - `react` — `useLayoutEffect`, `useRef`, `useState`
  - `lucide-react` — `Bitcoin`, `BookOpen`, `BriefcaseBusiness`, `Building2`, `ChartLine`, `ChevronDown`, …

## Used by

- `app/select-organization/page.tsx`
- `components/offices/OfficeGridView.tsx`
