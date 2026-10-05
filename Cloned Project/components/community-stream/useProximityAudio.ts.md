# `components/community-stream/useProximityAudio.ts`

> Hook that decides which remote participants the local user should hear: only those whose proximity circle overlaps the user's own in the 2D world.

**Kind:** React hook (client) · **Lines:** 107

## Purpose
Community Stream mimics a spatial office: you hear only the people standing near you. This hook combines two inputs:
- avatar positions, from `useAvatarPositions`;
- remote media tracks, from `useCommunityStreamLiveKit`.

It turns each remote user's audio on or off, and reports who is currently "in earshot".

## How it works
- `calculateOverlap(myPos, otherPos)` (private) computes the Euclidean distance between two world-pixel positions. It returns `distance < RADIUS_CIRCLE_SIZE` (300 px). Two circles of 300 px diameter (150 px radius) overlap exactly when their centres are less than 300 px apart.
- Main effect, re-run whenever `meId`, `positions`, `remoteUserTracks` or `inCall` changes:
  - When the user is not in a call, or has no position yet: call `audioTrack?.stop()` on every remote track and clear the set.
  - Otherwise, for each remote user other than self:
    - No position known: stop that user's audio.
    - Overlapping: add the user to the set. If `hasAudio` is true and an `audioTrack` exists, call `audioTrack.play()`.
    - Not overlapping: call `audioTrack.stop()`.
- Unmount and cleanup effect: stops every remote audio track.

## Exports
- `useProximityAudio(meId, positions, remoteUserTracks, containerRef, inCall)` returns `{ overlappingUsers: Set<string> }`. The arguments are:
  - `meId: string`: the local user's id.
  - `positions: Map<string, {x, y}>`: world positions in pixels.
  - `remoteUserTracks: Map<string, RemoteUserTracks>`: from the LiveKit hook.
  - `containerRef: React.RefObject<HTMLDivElement>`: **unused**.
  - `inCall: boolean`

## Dependencies
- **Internal:**
  - `./useCommunityStreamLiveKit`: the `RemoteUserTracks` type.
  - `./useAvatarPositions`: `RADIUS_CIRCLE_SIZE`.
- **Packages:** `react`.

## Used by
- `components/community-stream/CommunityStreamOverlay.tsx`, which calls it and ignores the return value.
- `components/community-stream/index.ts`

## Notes
- **Agora-style API on raw tracks.** `RemoteUserTracks.audioTrack` is a browser `MediaStreamTrack`, which has `stop()` but no `play()`.
  - Reaching the `play()` branch would therefore throw a `TypeError`.
  - Calling `stop()` on a received track ends it permanently; it does not mute it. A user who walks out of range and back again would not be heard again.
  - The hook never attaches the audio to an `<audio>` element, so it cannot actually make remote audio audible.
  - The code appears to have been ported from Agora, whose track objects do expose `play()` and `stop()`. Proximity audio will not work as intended until it is rewritten for `MediaStreamTrack` or LiveKit tracks; one option is to attach the tracks to audio elements and toggle their volume or `muted` state.
- The in-app docs (`app/docs/content/chapters/04-office.ts`) say voices get louder as avatars move closer. The actual logic is a binary in-range / out-of-range check, with no volume falloff.
