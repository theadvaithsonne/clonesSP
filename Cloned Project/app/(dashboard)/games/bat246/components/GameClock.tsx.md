# `app/(dashboard)/games/bat246/components/GameClock.tsx`

> A one-line compatibility shim that re-exports `GameClock` from its new home in `components/bat246/GameClock.tsx`.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 3

## Purpose
The BAT246 game-clock component used to live in this route folder and was moved to the shared `components/bat246/` folder with the other board components. This file keeps the old import path `@/app/(dashboard)/games/bat246/components/GameClock` working.

## How it works
It contains a comment ("Moved to components/bat246/GameClock.tsx") and one named re-export. It has no logic or markup. Next.js does not treat it as a route because it is not a special file name such as `page.tsx`.

## Exports
- `GameClock` - re-exported unchanged from `@/components/bat246/GameClock`.

## Dependencies
- **Internal:** `components/bat246/GameClock.tsx` - the real implementation.

## Used by
Nothing imports it, so it appears unused. Current code is expected to import `@/components/bat246/GameClock` directly.

## Notes
- Dead code kept for backwards compatibility, like the sibling `BoardLayout.tsx` shim in the same folder. It is safe to remove once you confirm nothing imports the old path.
