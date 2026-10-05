# `components/feed/ReactionDisplay.tsx`

> React components `ReactionDisplay`, `ReactionSummary`.

**Kind:** React component · **Lines:** 122 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Props

- **`ReactionDisplay`**: `reactionsCount: ReactionsCount | undefined`, `likesCount?: number`, `onClick?: () => void`, `className?: string`
- **`ReactionSummary`**: `reactionsCount: ReactionsCount | undefined`, `likesCount?: number`, `userReaction?: ReactionType | null`, `onClick?: () => void`

**Hooks used:** `useMemo`×2

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `ReactionDisplay` | component | `ReactionDisplay({ reactionsCount, likesCount = 0, onClick, className = "", …)` | 18 |
| `ReactionSummary` | component | `ReactionSummary({ reactionsCount, likesCount = 0, userReaction, onClick, }:…)` | 73 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/feed-api.ts` — `ReactionsCount`, `ReactionType`, `REACTION_EMOJIS`, `getTopReactions`
- **Packages:**
  - `react` — `useMemo`

## Used by

- `components/dashboard/FeedComponents.tsx`
- `components/dashboard/PostDetailModal.tsx`
- `components/dashboard/PostDetailView.tsx`
