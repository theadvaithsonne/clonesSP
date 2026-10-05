# `hooks/livekit/useVideoGrid.ts`

> Hook that returns a CSS grid style for a video tile grid, choosing the column layout from the number of LiveKit participants.

**Kind:** React hook · **Lines:** 19

## Purpose
Keeps the layout rule for the LiveKit video grid in one place: one full tile, a 2-column grid, or an auto-fill grid, depending on participant count.

## How it works
Memoised on `count = participants.length`; every style includes `gridAutoRows: '1fr'`.
- 0-1 participants: `gridTemplateColumns: '1fr'` (one tile fills the area).
- 2-4: `repeat(2, 1fr)` columns and `repeat(ceil(count/2), 1fr)` rows (a 2x1 or 2x2 grid).
- 5+: `repeat(auto-fill, minmax(240px, 1fr))`, so tiles wrap at a 240px minimum width.

## Exports
- `useVideoGrid(participants: Participant[]): { gridStyle: React.CSSProperties; count: number }`

## Dependencies
- **Packages:** `livekit-client` - `Participant` type; `react` - `useMemo`.

## Used by
- `components/livekit/VideoGrid.tsx`.

## Notes
- Identical to `hooks/office/useVideoGrid.ts`.
- Relies on the global `React` namespace for `React.CSSProperties` without importing it.
