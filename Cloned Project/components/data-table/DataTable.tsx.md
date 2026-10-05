# `components/data-table/DataTable.tsx`

> React component `DataTable`.

**Kind:** React component · **Lines:** 1020 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Check`×2 (local), `AnimatePresence`×2 (framer-motion), `ArrowUp`×2 (lucide-react), `ArrowDown`×2 (lucide-react), `Item`×2 (local), `PageButton`×2 (local), `X` (lucide-react), `SortAffix` (local), `ListFilter` (lucide-react), `FilterMenu` (local), `SortMenu` (local), `SkeletonRows` (local), `DataRow` (local), `Footer` (local), `ChevronsUpDown` (lucide-react), `CheckIcon` (lucide-react), `ChevronLeft` (lucide-react), `ChevronRight` (lucide-react)

### Props

- **`DataTable`**: `props: DataTableProps<T>`

**Hooks used:** `useState`×7, `useMemo`×5, `useEffect`×3, `useCallback`×3, `useRef`×3, `usePersistentLayout` (local)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `DataTable` | component | `DataTable({ mergeTail, tableId, columns, rows, getRowId, loading, emp…)` | 116 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/data-table/motion.ts` — `DUR`, `EASE`, `T`, `cssEase`
  - `components/data-table/types.ts` — `ColumnDef`, `DataTableProps`, `SortOrder`, `(types only)`
- **Packages:**
  - `react` — `memo`, `useCallback`, `useEffect`, `useMemo`, `useRef`, `useState`, …
  - `framer-motion` — `AnimatePresence`, `motion`
  - `lucide-react` — `ArrowDown`, `ArrowUp`, `Check as CheckIcon`, `ChevronLeft`, `ChevronRight`, `ChevronsUpDown`, …

## Used by

- `app/garage-admin/(admin-dashboard)/affiliate-guests/page.tsx`
- `app/garage-admin/(admin-dashboard)/companies/page.tsx`
- `app/garage-admin/(admin-dashboard)/daily-reports/page.tsx`
- `app/garage-admin/(admin-dashboard)/founders/page.tsx`
- `app/garage-admin/(admin-dashboard)/networkchain-subs/page.tsx`
- `app/garage-admin/(admin-dashboard)/networkchains/axons/page.tsx`
- `app/garage-admin/(admin-dashboard)/networkchains/earngpt-learning/page.tsx`
- `app/garage-admin/(admin-dashboard)/networkchains/offerings/page.tsx`
- `app/garage-admin/(admin-dashboard)/networkchains/sentry/page.tsx`
- `app/garage-admin/(admin-dashboard)/networkchains/subscriptions/page.tsx`
- `app/garage-admin/(admin-dashboard)/networkchains/users/page.tsx`
- `app/garage-admin/(admin-dashboard)/one-time-affiliates/page.tsx`
- `app/garage-admin/(admin-dashboard)/rank-bonus/page.tsx`
- `app/garage-admin/(admin-dashboard)/users/page.tsx`
- `components/dashboard/founderGrid/orders/FounderOrdersTable.tsx`
- `components/dashboard/founderGrid/unsubLog/UnsubLogTable.tsx`
- `components/dashboard/liveStreams/FounderLiveStreamsTable.tsx`
- `components/garage-admin/member-profile-view.tsx`
