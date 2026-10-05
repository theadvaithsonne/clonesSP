# `app/taskroom/[workspace]/dashboard/[space]/page.tsx`

> Next.js page rendered at `/taskroom/[workspace]/dashboard/[space]`.

**Kind:** Next.js page · **Lines:** 144 · **Directive:** `"use client"` · **Route:** `/taskroom/[workspace]/dashboard/[space]` (page)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `ListView` (app/taskroom/components/ListView.tsx)

### Props

- **`TaskroomsPage`**: `searchParams?: Promise<{ roomId?: string }> | { roomId?: string }`

**Hooks used:** `useMemo`×2, `useListViewDetailStore` (store/taskroom/listViewDetailStore.ts), `useState`, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (TaskroomsPage)` | component | `TaskroomsPage({ searchParams, }: { searchParams?: Promise<{ roomId?: stri…)` | 46 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `store/taskroom/listViewDetailStore.ts` — `useListViewDetailStore`
  - `app/taskroom/components/ListView.tsx` — `ListView`, `Task`, `TaskGroup`, `sortNewestFirst`
- **Packages:**
  - `react` — `useEffect`, `useMemo`, `useState`, `use`

## Used by

Entry: reached by the Next.js router at `/taskroom/[workspace]/dashboard/[space]` (page).
