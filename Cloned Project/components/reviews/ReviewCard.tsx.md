# `components/reviews/ReviewCard.tsx`

> React component `ReviewCard`.

**Kind:** React component · **Lines:** 279 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `BadgeCheck` (lucide-react), `StarRating` (components/reviews/StarRating.tsx), `Pencil` (lucide-react), `MessageSquareX` (lucide-react), `Trash2` (lucide-react)

### Props

- **`ReviewCard`**: `review: Review`, `onEdit?: (review: Review) => void`, `onDelete?: (review: Review) => void`, `onRemoveComment?: (review: Review) => void`, `onVoteChange?: (review: Review) => void`, `canModerate?: boolean`, `showVotes?: boolean`, `className?: string`

**Hooks used:** `useState`×4

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `ReviewCard` | component | `ReviewCard({ review, onEdit, onDelete, onRemoveComment, onVoteChange, …)` | 44 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/reviews/StarRating.tsx` — `StarRating`
  - `lib/utils.ts` — `cn`
  - `lib/reviews-api.ts` — `Review`, `ReviewVoteValue`, `voteOnReview`, `formatRelativeTime`
- **Packages:**
  - `react` — `useState`
  - `lucide-react` — `BadgeCheck`, `MessageSquareX`, `Pencil`, `Trash2`

## Used by

- `components/reviews/ReviewsModerationList.tsx`
- `components/reviews/ReviewsPanel.tsx`
- `components/reviews/index.ts`
