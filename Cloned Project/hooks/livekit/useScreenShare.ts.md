# `hooks/livekit/useScreenShare.ts`

> Minimal client hook that turns a LiveKit local participant's screen share on and off and tracks whether it is sharing.

**Kind:** React hook · **Lines:** 27

## Purpose
Gives the LiveKit `ControlBar` a `sharing` flag and start/stop/toggle callbacks without the control bar calling the LiveKit SDK directly. It is the simpler, older sibling of `hooks/office/useScreenShare.ts`, which adds browser-support checks, toasts and screen audio.

## How it works
- `startShare()` returns if `localParticipant` is undefined, otherwise awaits `localParticipant.setScreenShareEnabled(true)` (LiveKit opens the browser's screen picker) and sets `sharing = true`.
- `stopShare()` awaits `setScreenShareEnabled(false)` and sets `sharing = false`.
- `toggle()` calls one or the other based on `sharing`.
- No `try/catch`: if the user cancels the picker, the rejection reaches the caller and `sharing` stays false.

## Exports
- `useScreenShare(localParticipant: LocalParticipant | undefined): { sharing: boolean; startShare(): Promise<void>; stopShare(): Promise<void>; toggle(): Promise<void> }`

## Interfaces
- **External services:** LiveKit (screen-share track publication through `livekit-client`).

## Dependencies
- **Packages:** `livekit-client` - `LocalParticipant` type; `react` - `useState`, `useCallback`.

## Used by
- `components/livekit/ControlBar.tsx`.

## Notes
- `sharing` is local state only. If the user stops sharing from the browser's own "Stop sharing" bar, LiveKit unpublishes the track but this flag is not updated.
