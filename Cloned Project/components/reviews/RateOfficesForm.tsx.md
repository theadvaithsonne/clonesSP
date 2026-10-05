# `components/reviews/RateOfficesForm.tsx`

> React component `RateOfficesForm`.

**Kind:** React component · **Lines:** 561 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Loader2`×2 (lucide-react), `Building2`×2 (lucide-react), `OfficeRow`×2 (local), `StarRating`×2 (components/reviews/StarRating.tsx), `ReviewFormFields` (components/reviews/ReviewFormFields.tsx), `Crown` (lucide-react), `Check` (lucide-react), `ArrowRight` (lucide-react)

### Props

- **`RateOfficesForm`**: `open: boolean`, `onClose: () => void`, `defaultOfficeId?: string | null`, `onSubmitted?: () => void`

**Hooks used:** `useState`×8, `useEffect`×4, `useMemo`×3, `useMyOffices` (lib/hooks/useMyOffices.ts), `useCallback`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `RateOfficesForm` | component | `RateOfficesForm({ open, onClose, defaultOfficeId, onSubmitted, }: RateOffic…)` — Rate the offices you've joined. | 56 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/reviews/ReviewFormFields.tsx` — `ReviewFormFields`, `ReviewFormValue`, `EMPTY_REVIEW_FORM`, `validateReviewForm`
  - `components/reviews/StarRating.tsx` — `StarRating`
  - `lib/utils.ts` — `cn`
  - `lib/hooks/useMyOffices.ts` — `useMyOffices`, `MyOffice`
  - `lib/reviews-api.ts` — `Review`, `createReview`, `updateReview`, `getMyReview`
- **Packages:**
  - `react` — `useCallback`, `useEffect`, `useMemo`, `useState`
  - `lucide-react` — `ArrowRight`, `Building2`, `Check`, `Crown`, `Loader2`

## Used by

- `components/reviews/RatingsReviewsDialog.tsx`
- `components/reviews/index.ts`
