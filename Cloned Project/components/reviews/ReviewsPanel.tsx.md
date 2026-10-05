# `components/reviews/ReviewsPanel.tsx`

> React component `ReviewsPanel`.

**Kind:** React component · **Lines:** 311 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Loader2`×2 (lucide-react), `RatingBreakdown` (components/reviews/RatingBreakdown.tsx), `Select` (components/ui/select.tsx), `SelectTrigger` (components/ui/select.tsx), `ArrowUpDown` (lucide-react), `SelectValue` (components/ui/select.tsx), `SelectContent` (components/ui/select.tsx), `SelectItem` (components/ui/select.tsx), `ReviewCard` (components/reviews/ReviewCard.tsx), `WriteReviewDialog` (components/reviews/WriteReviewDialog.tsx)

### Props

- **`ReviewsPanel`**: `targetType: ReviewTargetType`, `targetId: string`, `showHeader?: boolean`, `className?: string`, `canModerate?: boolean`

**Hooks used:** `useState`×11, `useCallback`, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `ReviewsPanel` | component | `ReviewsPanel({ targetType, targetId, showHeader = true, className, canMo…)` — The full reviews experience: summary breakdown, star/sort filters and the paginated list. | 65 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/reviews/RatingBreakdown.tsx` — `RatingBreakdown`
  - `components/reviews/ReviewCard.tsx` — `ReviewCard`
  - `components/reviews/WriteReviewDialog.tsx` — `WriteReviewDialog`
  - `components/ui/select.tsx` — `Select`, `SelectContent`, `SelectItem`, `SelectTrigger`, `SelectValue`
  - `lib/utils.ts` — `cn`
  - `lib/reviews-api.ts` — `Review`, `ReviewSort`, `ReviewTargetType`, `RatingSummary`, `StarKey`, `emptySummary`, `listReviews`, `deleteReview`, … +1
- **Packages:**
  - `react` — `useCallback`, `useEffect`, `useState`
  - `lucide-react` — `ArrowUpDown`, `Loader2`

## Used by

- `components/reviews/index.ts`
