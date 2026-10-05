# `components/reviews/CardRatingRow.tsx`

> React component `CardRatingRow`.

**Kind:** React component · **Lines:** 82 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `StarRating`×2 (components/reviews/StarRating.tsx)

### Props

- **`CardRatingRow`**: `targetType: ReviewTargetType`, `targetId: string`, `summary?: RatingSummary`, `targetName?: string`, `className?: string`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `CardRatingRow` | component | `CardRatingRow({ targetType, targetId, summary, targetName, className, }: …)` — The one-line rating row on a Discover card: | 30 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/reviews/StarRating.tsx` — `StarRating`
  - `components/reviews/openReviewsPanel.ts` — `openReviewsPanel`
  - `lib/utils.ts` — `cn`
  - `lib/reviews-api.ts` — `RatingSummary`, `ReviewTargetType`, `formatReviewCount`
- **Packages:** none

## Used by

- `components/reviews/index.ts`
