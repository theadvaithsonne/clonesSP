# `components/feed/GifPickerModal.tsx`

> React component `GifPickerModal`.

**Kind:** React component · **Lines:** 310 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Dialog` (components/ui/dialog.tsx), `DialogContent` (components/ui/dialog.tsx), `X` (lucide-react), `Search` (lucide-react), `Loader2` (lucide-react)

### Props

- **`GifPickerModal`**: `open: boolean`, `onOpenChange: (open: boolean) => void`, `onSelectGif: (gif: GifObject) => void`

**Hooks used:** `useState`×4, `useCallback`×2, `useEffect`×2

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `GifPickerModal` | component | `GifPickerModal({ open, onOpenChange, onSelectGif, }: GifPickerModalProps)` | 67 |

## Interfaces

- **External HTTP calls:**
  - `GET https://api.giphy.com/v1/gifs/trending?api_key=${giphyKey}&limit=30&rating=g` (L83)
  - `GET https://api.giphy.com/v1/gifs/search?api_key=${giphyKey}&q=${encodeURIComponent(
          query
        )}&limit=30&rating=g` (L120)
- **Environment variables (`process.env`):** `NEXT_PUBLIC_GIPHY_API_KEY`
- **Timers / queues:** `setTimeout` at L160
- **External hosts mentioned in the code:** `api.giphy.com`, `giphy.com`

## Dependencies

- **Internal:**
  - `components/ui/dialog.tsx` — `Dialog`, `DialogContent`
  - `lib/utils.ts` — `cn`
- **Packages:**
  - `react` — `useState`, `useEffect`, `useCallback`
  - `lucide-react` — `X`, `Search`, `Loader2`

## Used by

- `components/feed/CommentInput.tsx`
- `components/feed/InlinePostComposer.tsx`
