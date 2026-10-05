# `components/reviews/RatingsReviewsDialog.tsx`

> React component `RatingsReviewsDialog`.

**Kind:** React component · **Lines:** 150 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `X` (lucide-react), `ReviewsModerationList` (components/reviews/ReviewsModerationList.tsx), `RateOfficesForm` (components/reviews/RateOfficesForm.tsx)

### Props

- **`RatingsReviewsDialog`**: `open: boolean`, `onClose: () => void`, `amIFounder?: boolean`, `orgId?: string | null`

**Hooks used:** `useEffect`×2, `useState`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `RatingsReviewsDialog` | component | `RatingsReviewsDialog({ open, onClose, amIFounder = false, orgId, }: RatingsRevie…)` — The "Ratings & Reviews" entry point from the sidebar user menu. | 32 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/reviews/RateOfficesForm.tsx` — `RateOfficesForm`
  - `components/reviews/ReviewsModerationList.tsx` — `ReviewsModerationList`
  - `lib/utils.ts` — `cn`
- **Packages:**
  - `react` — `useEffect`, `useState`
  - `lucide-react` — `X`

## Used by

- `components/reviews/index.ts`
