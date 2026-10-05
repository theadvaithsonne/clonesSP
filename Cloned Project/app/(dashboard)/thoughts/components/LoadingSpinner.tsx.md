# `app/(dashboard)/thoughts/components/LoadingSpinner.tsx`

> Loading indicators for the Thoughts app: a sized spinner with optional caption, and a masonry skeleton grid of placeholder note cards.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 63

## Purpose
Shared presentational helpers so every Thoughts section page shows the same loading state while notes are fetched from the notes API.

## How it works
- `LoadingSpinner` renders lucide's `Loader2` with `animate-spin` in the primary colour. `size` (`sm` / `md` / `lg`) maps to icon sizes `h-4`/`h-8`/`h-12` and caption sizes `text-xs`/`text-sm`/`text-base`. `text`, when given, is shown below the icon.
- `NotesGridSkeleton` renders `count` (default 6) pulsing grey cards in the same CSS-columns layout (`columns-1 sm:columns-2 lg:columns-3 xl:columns-4`) as the real note grid. Each card gets a random height between 150 and 250 px to mimic masonry.

## Exports
- `default LoadingSpinner({ size = "md", className?, text? })` - centred spinner with optional caption.
- `NotesGridSkeleton({ count = 6 })` - skeleton grid of placeholder note cards.

## Dependencies
- **Internal:** `lib/utils.ts` (`cn`) - class merging.
- **Packages:** `react`; `lucide-react` (`Loader2`).

## Used by
- `app/(dashboard)/thoughts/archive/page.tsx`
- `app/(dashboard)/thoughts/recovery/page.tsx`
- `app/(dashboard)/thoughts/starred/page.tsx`
- `app/(dashboard)/thoughts/trash/page.tsx`

## Notes
- `NotesGridSkeleton` uses `Math.random()` in render, so heights change on every re-render and would differ between server and client if it were ever server-rendered (the Thoughts pages are client components).
- The archive page imports `NotesGridSkeleton` but does not use it.
