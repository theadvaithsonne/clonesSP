# `lib/meeting-context.tsx`

> App-wide React context that keeps a LiveKit meet call alive across page navigation, exposing the call state from `useMeetLiveKit` plus join/leave and minimise/expand controls.

**Kind:** frontend library · **Lines:** 103

## Purpose
A meet call (the `/meet/join` flow) should keep running when the user navigates elsewhere in the app, shrinking into a floating or Picture-in-Picture view. To make that possible the LiveKit room cannot live inside the meet page component; it lives in this provider, which is mounted in the root `app/layout.tsx`. Pages and widgets read and control the call through `useMeeting()`.

## How it works
- State: `config` (`MeetConfig`: LiveKit `serverUrl`, `token`, `roomName`), `meta` (`MeetMeta`: `joinCode`, `meetTitle`, `displayName`, `participantId`, optional `affiliateId`), `isHost`, `minimized`.
- `useMeetLiveKit(config, isHost)` (from `app/meet/join/useMeetLiveKit.ts`) owns the actual LiveKit `Room`, tracks, device selection, screen share and so on.
- **Auto-join:** an effect calls `livekit.joinCall()` as soon as a `config` is set and the hook is neither in a call nor joining.
- `joinMeeting(config, meta, isHost)` only stores state (meta, host flag, un-minimise, then config); the effect performs the join.
- `leaveMeeting()` first calls the global `window.__closeMeetPip` (registered by `components/meet/PersistentPipRenderer.tsx`) to close any open PiP window, awaits `livekit.leaveCall()`, then clears config, meta, host flag and minimised state.
- `minimize()` / `expand()` toggle `minimized`, which the floating renderer uses to decide between the full call UI and the mini view.
- The context value spreads everything returned by `useMeetLiveKit` (e.g. `inCall`, `isJoining`, local/remote tracks, `toggleMicrophone`, `toggleCamera`, `toggleScreenShare`, device switching, active speaker) and adds the fields above; it is memoised.

## Exports
- `MeetingProvider({ children })` - provider component.
- `useMeeting()` - returns the context; throws if used outside `MeetingProvider`.
- `interface MeetConfig { serverUrl; token; roomName }`.
- `interface MeetMeta { joinCode; meetTitle; displayName; participantId; affiliateId? }`.

## Dependencies
- **Internal:** `app/meet/join/useMeetLiveKit.ts` - the LiveKit room hook whose API this context re-exposes.
- **Packages:** `react` - context, state, effects, memoisation.

## Used by
- `app/layout.tsx` - mounts `MeetingProvider` at the root.
- `app/meet/join/MeetVideoCall.tsx` - the meet call UI.
- `components/meet/PersistentPipRenderer.tsx` - floating/PiP rendering of the ongoing call.
- `hooks/office/useMeetChat.ts` - meet chat.

## Notes
- Because the value includes the whole `livekit` object, which changes on every track or state update, every `useMeeting()` consumer re-renders on each such change.
- Coupling to the PiP renderer is through the untyped global `window.__closeMeetPip`, not through React.
