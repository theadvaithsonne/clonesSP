# `app/(dashboard)/taskroom/all-taskrooms/components/search-list.tsx`

> React component `SearchList`.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 460 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Loader2`×4 (lucide-react), `SearchResultItem`×3 (app/(dashboard)/taskroom/all-taskrooms/components/search-result-item.tsx), `Search` (lucide-react), `X` (lucide-react)

### Props

- **`SearchList`**: `query: string`, `setQuery: (query: string) => void`, `orgId: string`, `userId: string`

**Hooks used:** `useRef`×4, `useState`×2, `useCallback`×2, `useEffect`×2

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (SearchList)` | component | `SearchList({ query, setQuery, orgId, userId, }: SearchListProps)` | 78 |

## Interfaces

- **External HTTP calls:**
  - `GET uatapi.garage.app?${params.toString()}` (L126)
- **Timers / queues:** `setTimeout` at L253
- **External hosts mentioned in the code:** `uatapi.garage.app`

## Dependencies

- **Internal:**
  - `app/(dashboard)/taskroom/all-taskrooms/components/search-result-item.tsx` — `SearchResultItem (default)`
- **Packages:**
  - `react` — `useState`, `useCallback`, `useRef`, `useEffect`
  - `lucide-react` — `Search`, `X`, `Loader2`

## Used by

- `app/(dashboard)/taskroom/all-taskrooms/components/AllTaskroomDashbaord.tsx`
- `app/(dashboard)/taskroom/overview/page.tsx`
