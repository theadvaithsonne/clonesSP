# `components/feed/ReactionPicker.tsx`

> React component `ReactionPicker`.

**Kind:** React component · **Lines:** 134 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `AnimatePresence` (framer-motion)

### Props

- **`ReactionPicker`**: `userReaction: ReactionType | null | undefined`, `onReact: (reactionType: ReactionType) => void`, `disabled?: boolean`, `children: React.ReactNode`

**Hooks used:** `useCallback`×4, `useState`×2, `useRef`×2

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `ReactionPicker` | component | `ReactionPicker({ userReaction, onReact, disabled = false, children, }: Rea…)` | 18 |

## Interfaces

- **Timers / queues:** `setTimeout` at L34, L43

## Dependencies

- **Internal:**
  - `lib/feed-api.ts` — `ReactionType`, `REACTION_TYPES`, `REACTION_EMOJIS`
- **Packages:**
  - `react` — `useState`, `useRef`, `useCallback`
  - `framer-motion` — `motion`, `AnimatePresence`

## Used by

- `components/dashboard/FeedComponents.tsx`
- `components/dashboard/PostDetailModal.tsx`
- `components/dashboard/PostDetailView.tsx`
- `components/feed/CommentThread.tsx`
