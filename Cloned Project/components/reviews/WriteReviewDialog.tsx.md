# `components/reviews/WriteReviewDialog.tsx`

> React component `WriteReviewDialog`.

**Kind:** React component · **Lines:** 176 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `X` (lucide-react), `ReviewFormFields` (components/reviews/ReviewFormFields.tsx), `Loader2` (lucide-react)

### Props

- **`WriteReviewDialog`**: `open: boolean`, `onClose: () => void`, `targetType: ReviewTargetType`, `targetId: string`, `existingReview?: Review | null`, `onSubmitted: (review: Review) => void`

**Hooks used:** `useState`×4, `useEffect`×2

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `WriteReviewDialog` | component | `WriteReviewDialog({ open, onClose, targetType, targetId, existingReview, onSu…)` | 28 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/reviews/ReviewFormFields.tsx` — `ReviewFormFields`, `ReviewFormValue`, `EMPTY_REVIEW_FORM`, `validateReviewForm`
  - `lib/reviews-api.ts` — `Review`, `ReviewTargetType`, `createReview`, `updateReview`
- **Packages:**
  - `react` — `useEffect`, `useState`
  - `lucide-react` — `X`, `Loader2`

## Used by

- `components/reviews/RatingsReviewsCard.tsx`
- `components/reviews/ReviewsPanel.tsx`
- `components/reviews/index.ts`
