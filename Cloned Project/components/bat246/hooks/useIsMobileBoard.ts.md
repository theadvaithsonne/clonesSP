# `components/bat246/hooks/useIsMobileBoard.ts`

> Hook that reports whether the viewport is at most 1023px wide, used to switch the BAT246 board page to its stacked mobile layout.

**Kind:** React hook · **Lines:** 31

## Purpose
The desktop BAT246 board is a fixed ~1,900px design that only scales down uniformly, so on tablets and large phones it becomes unreadable well before the repo's generic 768px mobile breakpoint. This hook uses its own breakpoint (`(max-width: 1023px)`, i.e. below Tailwind's `lg`) so the board page can render the swipeable mobile sections instead.

## How it works
- `subscribe` attaches a `change` listener to `window.matchMedia(QUERY)` and returns the cleanup.
- `getSnapshot` returns `matchMedia(QUERY).matches`; `getServerSnapshot` returns `false`, so the server renders the desktop layout and the client corrects it during hydration.
- `useIsMobileBoard` wires these into React's `useSyncExternalStore`, which keeps the value in sync with resizes without any effect or state.

## Exports
- `useIsMobileBoard(): boolean` - `true` when the viewport matches `(max-width: 1023px)`.

## Dependencies
- **Packages:** `react` - `useSyncExternalStore`.

## Used by
- `app/(dashboard)/games/bat246/[boardId]/page.tsx` (route `/games/bat246/[boardId]`), which renders `BoardMobileSections` when it returns true.

## Notes
- The doc comment mentions `BoardLayoutMobile`, but no component of that name exists; the page actually switches to `components/bat246/BoardMobileSections.tsx`.
