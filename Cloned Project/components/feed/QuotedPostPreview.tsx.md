# `components/feed/QuotedPostPreview.tsx`

> React component `QuotedPostPreview`.

**Kind:** React component · **Lines:** 107 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Props

- **`QuotedPostPreview`**: `quotedPost: QuotedPost | { _id: string; content: string; authorId: Po…`, `onClick?: () => void`, `compact?: boolean`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `QuotedPostPreview` | component | `QuotedPostPreview({ quotedPost, onClick, compact = false, }: QuotedPostPrevie…)` | 20 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/utils.ts` — `cn`
  - `lib/feed-api.ts` — `QuotedPost`, `PostAuthor`, `PostChannel`, `(types only)`
- **Packages:** none

## Used by

- `components/dashboard/FeedComponents.tsx`
- `components/feed/QuotePostModal.tsx`
