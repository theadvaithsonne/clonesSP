# `hooks/office/useCallTimer.ts`

> A tiny client hook that counts elapsed seconds while a conference call is active and returns them as a `mm:ss` / `hh:mm:ss` string.

**Kind:** React hook · **Lines:** 27

## Purpose
Supplies the running call-duration label shown in the standalone conference room (`/meet/conference/[orgId]/[roomId]`). Keeping it in a hook means the conference component only passes an "is the call live" flag and reads back a string.

## How it works
- Holds `seconds` in state and the interval handle in a ref.
- When `active` is `true`, a 1-second `setInterval` increments `seconds`.
- When `active` turns `false`, the interval is cleared and `seconds` resets to `0`.
- The effect cleanup clears the interval on unmount or whenever `active` changes.
- `formatted` is computed each render: `hh:mm:ss` once an hour has passed, otherwise `mm:ss`, all parts zero-padded.

## Exports
- `useCallTimer(active: boolean): { seconds: number; formatted: string }` - elapsed seconds and the formatted duration.

## Dependencies
- **Packages:** `react` - `useState`, `useEffect`, `useRef`.

## Used by
- `app/meet/conference/[orgId]/[roomId]/ConferenceCallStandalone.tsx` (route `/meet/conference/[orgId]/[roomId]`).

## Notes
- Identical to `hooks/livekit/useCallTimer.ts`, which is unused.
- Interval-based, so it is a display timer that can drift when the tab is throttled; it is not the recorded meeting duration.
