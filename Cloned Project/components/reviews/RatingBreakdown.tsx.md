# `components/reviews/RatingBreakdown.tsx`

> React component `RatingBreakdown`.

**Kind:** React component · **Lines:** 85 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `StarRating` (components/reviews/StarRating.tsx)

### Props

- **`RatingBreakdown`**: `summary: RatingSummary`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `RatingBreakdown` | component | `RatingBreakdown({ summary }: { summary: RatingSummary })` — The summary block at the top of the reviews panel: the large average on the left, then a divider, then one bar per star value with its percentage. | 20 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/reviews/StarRating.tsx` — `StarRating`
  - `lib/reviews-api.ts` — `RatingSummary`, `StarKey`, `formatReviewCount`
- **Packages:** none

## Used by

- `components/reviews/ReviewsPanel.tsx`
- `components/reviews/index.ts`
