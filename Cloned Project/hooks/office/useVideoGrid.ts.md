# `hooks/office/useVideoGrid.ts`

> Hook that returns a CSS grid style for the office video grid, choosing the column layout from the number of LiveKit participants.

**Kind:** React hook · **Lines:** 19

## Purpose
Holds the layout rule for the office/conference video tile grid so `components/office/VideoGrid.tsx` only has to spread `gridStyle` onto its container.

## How it works
Memoised on `count = participants.length`; every style includes `gridAutoRows: '1fr'`.
- 0-1 participants: one column (`'1fr'`).
- 2-4: two columns and `ceil(count/2)` equal rows.
- 5+: `repeat(auto-fill, minmax(240px, 1fr))`, so tiles wrap at a 240px minimum width.

## Exports
- `useVideoGrid(participants: Participant[]): { gridStyle: React.CSSProperties; count: number }`

## Dependencies
- **Packages:** `livekit-client` - `Participant` type; `react` - `useMemo`.

## Used by
- `components/office/VideoGrid.tsx`.

## Notes
- Byte-for-byte the same as `hooks/livekit/useVideoGrid.ts`.
- Uses the global `React` namespace for `React.CSSProperties` without importing it.
