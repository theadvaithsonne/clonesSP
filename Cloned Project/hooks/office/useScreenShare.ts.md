# `hooks/office/useScreenShare.ts`

> Client hook that starts and stops screen sharing (with tab/system audio) for a LiveKit local participant, with a browser-support check and user-friendly toasts.

**Kind:** React hook · **Lines:** 66

## Purpose
Drives the screen-share button in the office/conference `ControlBar`. Compared with `hooks/livekit/useScreenShare.ts`, it handles the real-world failure cases: mobile browsers with no screen-capture API, users cancelling the OS picker, and SDK errors.

## How it works
- `screenShareSupported()` (module-private) returns true only when `navigator.mediaDevices.getDisplayMedia` is a function. The comment notes iOS Safari/WebView has no such API at all.
- `startShare()`:
  - Returns if there is no `localParticipant`.
  - Unsupported browser: shows a `toast.error` telling the user to use the NetworkChains app on phones or share from a computer.
  - Otherwise awaits `localParticipant.setScreenShareEnabled(true, { audio: true })` and sets `sharing = true`.
  - Errors named `NotAllowedError` or `AbortError` (user dismissed the picker) are swallowed silently; anything else shows "Couldn't start screen sharing on this device.". In both cases `sharing` stays false.
- `stopShare()` disables the share, ignoring errors if the track is already gone, then sets `sharing = false`.
- `toggle()` picks start or stop from the current flag.
- `supported` is computed on every render from `screenShareSupported()` so the UI can hide or disable the button.

## Exports
- `useScreenShare(localParticipant: LocalParticipant | undefined): { sharing: boolean; startShare(): Promise<void>; stopShare(): Promise<void>; toggle(): Promise<void>; supported: boolean }`

## Interfaces
- **External services:** LiveKit (screen-share publication via `livekit-client`); browser `getDisplayMedia`.

## Dependencies
- **Packages:** `livekit-client` - `LocalParticipant` type; `react`; `sonner` - `toast.error` messages.

## Used by
- `components/office/ControlBar.tsx`.

## Notes
- `sharing` is local state; stopping through the browser's native "Stop sharing" bar unpublishes the track without updating this flag.
- The unsupported-browser toast mentions the "NetworkChains app": a leftover from the code's NetworkChains origin.
