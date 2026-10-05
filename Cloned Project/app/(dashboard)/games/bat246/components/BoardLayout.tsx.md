# `app/(dashboard)/games/bat246/components/BoardLayout.tsx`

> A one-line compatibility shim that re-exports `BoardLayout` from its new home in `components/bat246/BoardLayout.tsx`.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 3

## Purpose
The BAT246 board layout component used to live inside the game's route folder. It was moved to the shared `components/bat246/` folder so that pages outside this route (and the mobile board views) could use it. This file was left behind so that any old import path `@/app/(dashboard)/games/bat246/components/BoardLayout` keeps compiling.

## How it works
It contains a comment ("Moved to components/bat246/BoardLayout.tsx") and a single named re-export. It has no logic, state or markup of its own. Because it is not named `page.tsx`, `layout.tsx` or `route.ts`, Next.js does not turn it into a route.

## Exports
- `BoardLayout` - re-exported unchanged from `@/components/bat246/BoardLayout` (the desktop BAT246 board renderer: bases, dugout, POD art, child-board navigation, modals).

Only `BoardLayout` is re-exported. Other names exported by the real module (for example the `PendingPlacement` type that `[boardId]/page.tsx` imports) are not available through this shim.

## Dependencies
- **Internal:** `components/bat246/BoardLayout.tsx` - the real implementation.

## Used by
Nothing imports it. Current code imports `@/components/bat246/BoardLayout` directly (for example `app/(dashboard)/games/bat246/[boardId]/page.tsx`), so this shim appears unused.

## Notes
- Dead code kept for backwards compatibility. It is safe to delete once you confirm nothing imports the old path.
- See the sibling shim `GameClock.tsx`, which follows the same pattern.
