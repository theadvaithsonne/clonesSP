# `components/offices/OfficeGridView.tsx`

> React components `OfficeGridView`, `OfficeGrid`, `CreateOfficeNote`.

**Kind:** React component · **Lines:** 337 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `PillButton`×4 (components/offices/ui.tsx), `Pill`×3 (components/offices/ui.tsx), `Loader2`×2 (lucide-react), `OfficeGrid`×2 (local), `BackLink` (components/offices/ui.tsx), `CategoryRail` (components/offices/CategoryNav.tsx), `OfficeCardSkeleton` (components/offices/OfficeCard.tsx), `LoadingMessage` (components/offices/OfficesSkeletons.tsx), `RotateCcw` (lucide-react), `EmptyResults` (local), `OfficeCard` (components/offices/OfficeCard.tsx), `Pagination` (components/offices/ui.tsx), `Plus` (lucide-react), `SearchX` (lucide-react), `X` (lucide-react), `Eyebrow` (components/offices/ui.tsx), `CategoryTiles` (components/offices/CategoryNav.tsx), `CreateOfficeNote` (local), `Lightbulb` (lucide-react)

### Props

- **`OfficeGridView`**: `mode: GridMode`, `categories: DiscoverCategory[]`, `categoriesLoading: boolean`, `renderFooter: (office: DiscoverOffice) => React.ReactNode`, `isMember: (officeId: string) => boolean`, `onOpenOffice: (office: DiscoverOffice) => void`, `onSelectCategory: (category: string | null) => void`, `onPage: (page: number) => void`, `onClearSearch: () => void`, `onCreateOffice: () => void`, `onBack: () => void`
- **`OfficeGrid`**: `children: React.ReactNode`
- **`CreateOfficeNote`**: `onCreateOffice: () => void`

**Hooks used:** `useState`×7, `useRef`×2, `useEffect`, `useCallback`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `GridMode` | type |  | 21 |
| `OfficeGridView` | component | `OfficeGridView({ mode, categories, categoriesLoading, renderFooter, isMemb…)` — The full-page lists: every office (paged), one category, or a search (both with "Load more"), including their loading and empty states. | 34 |
| `OfficeGrid` | component | `OfficeGrid({ children }: { children: React.ReactNode })` | 268 |
| `CreateOfficeNote` | component | `CreateOfficeNote({ onCreateOffice }: { onCreateOffice: () => void })` | 326 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/utils.ts` — `cn`
  - `lib/discover-api.ts` — `fetchDiscoverOffices`, `DiscoverCategory`, `DiscoverOffice`, `DiscoverPagination`
  - `components/offices/CategoryNav.tsx` — `CategoryRail`, `CategoryTiles`
  - `components/offices/OfficeCard.tsx` — `OfficeCard`, `OfficeCardSkeleton`
  - `components/offices/OfficesSkeletons.tsx` — `LoadingMessage`
  - `components/offices/ui.tsx` — `BackLink`, `Eyebrow`, `Pagination`, `Pill`, `PillButton`
- **Packages:**
  - `react` — `useCallback`, `useEffect`, `useRef`, `useState`
  - `lucide-react` — `Lightbulb`, `Loader2`, `Plus`, `RotateCcw`, `SearchX`, `X`

## Used by

- `app/select-organization/page.tsx`
