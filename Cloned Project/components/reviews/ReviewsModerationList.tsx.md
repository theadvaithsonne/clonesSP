# `components/reviews/ReviewsModerationList.tsx`

> React component `ReviewsModerationList`.

**Kind:** React component · **Lines:** 266 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Loader2`×2 (lucide-react), `Icon` (local), `MessagesSquare` (lucide-react), `TargetIcon` (local), `ShieldAlert` (lucide-react), `ReviewCard` (components/reviews/ReviewCard.tsx)

### Props

- **`ReviewsModerationList`**: `orgId: string`, `className?: string`

**Hooks used:** `useState`×9, `useCallback`, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `ReviewsModerationList` | component | `ReviewsModerationList({ orgId, className, }: ReviewsModerationListProps)` — Every review across the org, newest first — the founder's cross-product view. | 65 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/reviews/ReviewCard.tsx` — `ReviewCard`
  - `components/reviews/targetIcons.ts` — `REVIEW_TARGET_ICONS`
  - `lib/utils.ts` — `cn`
  - `lib/reviews-api.ts` — `ModerationReview`, `ReviewTargetType`, `REVIEW_TARGET_LABELS`, `listOrgReviews`, `removeReviewComment`
- **Packages:**
  - `react` — `useCallback`, `useEffect`, `useState`
  - `lucide-react` — `Loader2`, `MessagesSquare`, `ShieldAlert`

## Used by

- `components/reviews/RatingsReviewsDialog.tsx`
- `components/reviews/index.ts`
