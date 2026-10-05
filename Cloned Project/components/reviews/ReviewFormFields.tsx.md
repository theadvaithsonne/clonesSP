# `components/reviews/ReviewFormFields.tsx`

> React component `ReviewFormFields`.

**Kind:** React component · **Lines:** 322 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `StarRatingInput` (components/reviews/StarRating.tsx), `X` (lucide-react), `Loader2` (lucide-react), `Upload` (lucide-react)

### Props

- **`ReviewFormFields`**: `value: ReviewFormValue`, `onChange: (next: ReviewFormValue) => void`, `disabled?: boolean`, `onUploadingChange?: (uploading: boolean) => void`, `onError?: (message: string) => void`

**Hooks used:** `useState`×3, `useRef`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `MAX_IMAGES` | const | `= 6` | 10 |
| `MAX_BODY` | const | `= 500` | 14 |
| `MAX_TITLE` | const | `= 140` | 15 |
| `countBodyChars` | function | `countBodyChars(value: string): number` — Body length for limit purposes: whitespace doesn't count. | 21 |
| `ReviewFormValue` | interface |  | 25 |
| `EMPTY_REVIEW_FORM` | const | `= { rating: 0, title: "", body: "", images: [], }` | 32 |
| `validateReviewForm` | function | `validateReviewForm(value: ReviewFormValue): string \| null` — The client-side guard rails, shared by every surface that submits a review. | 45 |
| `ReviewFormFields` | component | `ReviewFormFields({ value, onChange, disabled = false, onUploadingChange, onE…)` — Rating / headline / details / attachments — the body of the write-a-review form, with no dialog chrome and no submit button. | 74 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/reviews/StarRating.tsx` — `StarRatingInput`
  - `lib/utils.ts` — `cn`
  - `lib/feed-api.ts` — `uploadFile`
  - `lib/reviews-api.ts` — `RATING_LABELS`, `StarKey`
- **Packages:**
  - `react` — `useRef`, `useState`
  - `lucide-react` — `Upload`, `X`, `Loader2`

## Used by

- `components/reviews/RateOfficesForm.tsx`
- `components/reviews/WriteReviewDialog.tsx`
- `components/reviews/index.ts`
