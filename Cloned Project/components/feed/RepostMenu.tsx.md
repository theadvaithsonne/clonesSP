# `components/feed/RepostMenu.tsx`

> React component `RepostMenu`.

**Kind:** React component · **Lines:** 130 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Repeat2`×2 (lucide-react), `AnimatePresence` (framer-motion), `Undo2` (lucide-react), `Quote` (lucide-react)

### Props

- **`RepostMenu`**: `postId: string`, `isReposted: boolean`, `repostCount: number`, `onRepost: (postId: string) => void`, `onQuote: (postId: string) => void`, `onUndoRepost?: (postId: string) => void`

**Hooks used:** `useRef`×2, `useState`, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `RepostMenu` | component | `RepostMenu({ postId, isReposted, repostCount, onRepost, onQuote, onUnd…)` | 17 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/utils.ts` — `cn`
- **Packages:**
  - `react` — `useState`, `useRef`, `useEffect`
  - `framer-motion` — `motion`, `AnimatePresence`
  - `lucide-react` — `Repeat2`, `Quote`, `Undo2`

## Used by

- `components/dashboard/FeedComponents.tsx`
