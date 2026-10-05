# `hooks/livekit/useCallTimer.ts`

> A tiny client hook that counts elapsed seconds while a call is active and returns them as a `mm:ss` / `hh:mm:ss` string.

**Kind:** React hook · **Lines:** 27

## Purpose
Gives call UIs a ready-made duration readout ("04:12", "01:03:09") without each screen managing its own interval. It belongs to the `hooks/livekit/` set of LiveKit meeting helpers, an older copy of the hooks that now live in `hooks/office/`.

## How it works
- Holds `seconds` in state and the interval handle in a ref.
- When `active` becomes `true`, it starts a 1-second `setInterval` that increments `seconds`.
- When `active` becomes `false`, it clears the interval and resets `seconds` to `0`, so the next call starts from zero.
- The effect cleanup always clears the interval (on unmount or when `active` changes).
- The formatted string is derived on every render: hours are shown only when `seconds >= 3600`; every part is zero-padded to two digits.

## Exports
- `useCallTimer(active: boolean): { seconds: number; formatted: string }` - elapsed seconds and the formatted duration.

## Dependencies
- **Packages:** `react` - `useState`, `useEffect`, `useRef`.

## Used by
Nothing imports this file; it appears unused. The live copy is `hooks/office/useCallTimer.ts` (byte-for-byte the same logic), used by `app/meet/conference/[orgId]/[roomId]/ConferenceCallStandalone.tsx`.

## Notes
- Duplicate of `hooks/office/useCallTimer.ts`; a change made to one is not reflected in the other.
- The count is driven by `setInterval`, so it can drift slightly when the tab is throttled in the background; it is a display timer, not an authoritative call duration.
