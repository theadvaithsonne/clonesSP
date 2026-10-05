# `app/(dashboard)/taskroom/all-taskrooms/componentsSymbol/timeline-view.tsx`

> React component `TimelineView`.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 836 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Loader2`×4 (lucide-react), `Button`×3 (components/ui/button.tsx), `ChevronLeft` (lucide-react), `ChevronRight` (lucide-react), `Calendar` (lucide-react)

### Props

- **`TimelineView`**: `columns: Column[]`, `employees: Employee[]`, `onTaskClick?: (task: Task) => void`, `stagecolumns: Task[]`, `fetchListView: (page: number) => Promise<void>`, `hasMore: boolean`, `isFetching: boolean`, `nextPageToFetch: number`

**Hooks used:** `useEffect`×6, `useRef`×5, `useState`×4, `useCallback`×2, `useDragScroll`×2 (local), `useMemo`×2

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `TimelineView` | component | `TimelineView({ columns, employees, onTaskClick, stagecolumns: rawTasks =…)` | 283 |

## Interfaces

- **Timers / queues:** `setTimeout` at L415, L426, L488, L547, L564

## Dependencies

- **Internal:**
  - `components/ui/button.tsx` — `Button`
  - `components/ui/avatar.tsx` — `Avatar`, `AvatarFallback`
  - `app/(dashboard)/taskroom/all-taskrooms/types/kanban.ts` — `Column`, `Task`, `Employee`, `(types only)`
- **Packages:**
  - `react` — `useRef`, `useEffect`, `useMemo`, `useState`, `useCallback`
  - `lucide-react` — `ChevronLeft`, `ChevronRight`, `AlertTriangle`, `Loader2`, `Calendar`

## Used by

- `app/(dashboard)/taskroom/all-taskrooms/componentsSymbol/kanban-board.tsx`
