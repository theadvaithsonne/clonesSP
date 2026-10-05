# `components/reviews/StarRating.tsx`

> React components `StarRating`, `StarRatingInput`.

**Kind:** React component · **Lines:** 140 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Star`×3 (lucide-react)

### Props

- **`StarRating`**: `value: number`, `size?: number`, `tone?: "accent" | "muted"`, `className?: string`
- **`StarRatingInput`**: `value: number`, `onChange: (value: number) => void`, `hoverValue?: number`, `onHoverChange?: (value: number) => void`, `size?: number`, `disabled?: boolean`, `className?: string`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `StarRating` | component | `StarRating({ value, size = 14, tone = "accent", className, }: StarRati…)` — Read-only star display. | 26 |
| `StarRatingInput` | component | `StarRatingInput({ value, onChange, hoverValue = 0, onHoverChange, size = 26…)` — Interactive star picker for the write-review modal. | 93 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/utils.ts` — `cn`
- **Packages:**
  - `lucide-react` — `Star`

## Used by

- `components/reviews/CardRatingRow.tsx`
- `components/reviews/RateOfficesForm.tsx`
- `components/reviews/RatingBreakdown.tsx`
- `components/reviews/RatingsReviewsCard.tsx`
- `components/reviews/ReviewCard.tsx`
- `components/reviews/ReviewFormFields.tsx`
- `components/reviews/index.ts`
