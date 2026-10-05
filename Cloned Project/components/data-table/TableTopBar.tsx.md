# `components/data-table/TableTopBar.tsx`

> React component `TableTopBar`.

**Kind:** React component · **Lines:** 195 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `AnimatePresence`×2 (framer-motion), `Search`×2 (lucide-react), `SlidersHorizontal` (lucide-react), `ChevronDown` (lucide-react), `X` (lucide-react)

### Props

- **`TableTopBar`**: `views?: TopBarView[]`, `activeView?: string`, `onViewChange?: (id: string) => void`, `search?: string`, `onSearchChange?: (v: string) => void`, `searchPlaceholder?: string`, `onOpenFilters?: () => void`, `filterActive?: boolean`, `leftActions?: React.ReactNode`, `actions?: React.ReactNode`

**Hooks used:** `useState`×2, `useRef`, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `TopBarView` | interface | A saved view / quick-filter preset — the Bigin "Views" dropdown. | 11 |
| `TableTopBar` | component | `TableTopBar({ views, activeView, onViewChange, search, onSearchChange, …)` — The shared, page-agnostic table top bar (generalized from the downline bar): an optional filter toggle, an optional Views selector, the Bigin search-morph, and a right-side actions slot. | 25 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/data-table/motion.ts` — `DUR`, `EASE`, `cssEase`
- **Packages:**
  - `react` — `useEffect`, `useRef`, `useState`
  - `framer-motion` — `motion`, `AnimatePresence`
  - `lucide-react` — `Search`, `SlidersHorizontal`, `ChevronDown`, `X`

## Used by

- `app/garage-admin/(admin-dashboard)/networkchains/axons/page.tsx`
- `app/garage-admin/(admin-dashboard)/networkchains/earngpt-learning/page.tsx`
- `app/garage-admin/(admin-dashboard)/networkchains/offerings/page.tsx`
- `app/garage-admin/(admin-dashboard)/networkchains/sentry/page.tsx`
- `app/garage-admin/(admin-dashboard)/networkchains/subscriptions/page.tsx`
- `app/garage-admin/(admin-dashboard)/networkchains/users/page.tsx`
