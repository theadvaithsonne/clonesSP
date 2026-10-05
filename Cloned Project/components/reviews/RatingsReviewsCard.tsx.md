# `components/reviews/RatingsReviewsCard.tsx`

> React component `RatingsReviewsCard`.

**Kind:** React component · **Lines:** 156 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `StarRating`×2 (components/reviews/StarRating.tsx), `PenLine` (lucide-react), `WriteReviewDialog` (components/reviews/WriteReviewDialog.tsx)

### Props

- **`RatingsReviewsCard`**: `targetType: ReviewTargetType`, `targetId: string`, `targetName?: string`, `showWriteButton?: boolean`, `className?: string`

**Hooks used:** `useState`×3, `useEffect`×2, `useCallback`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `RatingsReviewsCard` | component | `RatingsReviewsCard({ targetType, targetId, targetName, showWriteButton = true,…)` — The compact "Ratings & Reviews" card that sits under the About card on a community page: average, stars, review count, a "See all" link that opens the full panel in the right sidebar, and the write-a-review entry point. | 40 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/reviews/StarRating.tsx` — `StarRating`
  - `components/reviews/WriteReviewDialog.tsx` — `WriteReviewDialog`
  - `components/reviews/openReviewsPanel.ts` — `openReviewsPanel`
  - `lib/utils.ts` — `cn`
  - `lib/reviews-api.ts` — `RatingSummary`, `MyReviewResult`, `ReviewTargetType`, `emptySummary`, `formatReviewCount`, `getMyReview`, `getRatingSummary`, `NO_REVIEW_ACCESS`
- **Packages:**
  - `react` — `useCallback`, `useEffect`, `useState`
  - `lucide-react` — `PenLine`

## Used by

- `components/reviews/index.ts`
