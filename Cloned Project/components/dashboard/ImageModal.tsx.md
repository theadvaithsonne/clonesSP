# `components/dashboard/ImageModal.tsx`

> React component `ImageModal`.

**Kind:** React component · **Lines:** 344 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `AnimatePresence` (framer-motion), `X` (lucide-react), `ChevronLeft` (lucide-react), `ChevronRight` (lucide-react), `Heart` (lucide-react), `MessageCircle` (lucide-react), `Input` (components/ui/input.tsx), `Button` (components/ui/button.tsx), `Send` (lucide-react)

### Props

- **`ImageModal`**: `isOpen: boolean`, `onClose: () => void`, `post: Post`, `initialImageIndex?: number`, `onLike: (postId: string) => void`, `onComment: (postId: string, content: string) => void`

**Hooks used:** `useState`×6, `useEffect`×3, `useCallback`×2

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `ImageModal` | component | `ImageModal({ isOpen, onClose, post, initialImageIndex = 0, onLike, onC…)` | 27 |

## Interfaces

- **Timers / queues:** `setTimeout` at L117

## Dependencies

- **Internal:**
  - `components/ui/button.tsx` — `Button`
  - `components/ui/input.tsx` — `Input`
  - `lib/utils.ts` — `cn`
  - `lib/revenue-network-api.ts` — `Post`, `getPostComments`
- **Packages:**
  - `react` — `useState`, `useEffect`, `useCallback`
  - `lucide-react` — `X`, `ChevronLeft`, `ChevronRight`, `Heart`, `MessageCircle`, `Send`
  - `framer-motion` — `motion`, `AnimatePresence`

## Used by

No other file imports this one and it has no automatic entry point — it appears unused (or is loaded dynamically by a path the import graph cannot see).
