# `components/feed/TrendingHashtags.tsx`

> React component `TrendingHashtags`.

**Kind:** React component · **Lines:** 118 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `TrendingUp` (lucide-react), `Loader2` (lucide-react), `Hash` (lucide-react), `ChevronRight` (lucide-react)

### Props

- **`TrendingHashtags`**: `orgId: string`, `onTagClick?: (tag: string) => void`, `limit?: number`, `className?: string`

**Hooks used:** `useState`×3, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `TrendingHashtags` | component | `TrendingHashtags({ orgId, onTagClick, limit = 10, className, }: TrendingHash…)` | 16 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/utils.ts` — `cn`
  - `lib/feed-api.ts` — `getTrendingTags`, `TrendingTag`
- **Packages:**
  - `react` — `useState`, `useEffect`
  - `framer-motion` — `motion`
  - `lucide-react` — `TrendingUp`, `Hash`, `ChevronRight`, `Loader2`

## Used by

No other file imports this one and it has no automatic entry point — it appears unused (or is loaded dynamically by a path the import graph cannot see).
