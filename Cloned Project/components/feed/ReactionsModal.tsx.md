# `components/feed/ReactionsModal.tsx`

> React component `ReactionsModal`.

**Kind:** React component · **Lines:** 259 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Loader2`×2 (lucide-react), `AnimatePresence` (framer-motion), `X` (lucide-react), `Avatar` (components/ui/avatar.tsx), `AvatarImage` (components/ui/avatar.tsx), `AvatarFallback` (components/ui/avatar.tsx)

### Props

- **`ReactionsModal`**: `isOpen: boolean`, `onClose: () => void`, `postId: string`, `initialByType?: Record<ReactionType, number>`

**Hooks used:** `useState`×7, `useEffect`×2, `useCallback`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `ReactionsModal` | component | `ReactionsModal({ isOpen, onClose, postId, initialByType, }: ReactionsModal…)` | 25 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/ui/avatar.tsx` — `Avatar`, `AvatarFallback`, `AvatarImage`
  - `lib/feed-api.ts` — `ReactionType`, `REACTION_TYPES`, `REACTION_EMOJIS`, `REACTION_LABELS`, `PostReaction`, `getPostReactions`
- **Packages:**
  - `react` — `useState`, `useEffect`, `useCallback`
  - `lucide-react` — `X`, `Loader2`
  - `framer-motion` — `motion`, `AnimatePresence`

## Used by

- `components/dashboard/FeedComponents.tsx`
- `components/dashboard/PostDetailModal.tsx`
- `components/dashboard/PostDetailView.tsx`
