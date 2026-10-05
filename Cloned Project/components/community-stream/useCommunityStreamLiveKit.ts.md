# `components/community-stream/useCommunityStreamLiveKit.ts`

> Dedicated LiveKit media hook for Community Stream. It connects a `livekit-client` `Room` when the backend signals a `community-stream:` call, publishes the user's camera and microphone, and exposes local and remote tracks plus mute and screen-share controls.

**Kind:** React hook (client) · **Lines:** 398

## Purpose
The workspace already has a LiveKit hook (`useLiveKit`) for knock calls and floor meetings. Community Stream needs different audio behaviour: remote audio must **not** auto-play, because `useProximityAudio` decides who is audible. This hook is a separate, isolated LiveKit client so the two cannot conflict, and it reacts only to events whose room name looks like a community stream.

## How it works
### State
- `roomRef`: the active `Room`.
- `inCall`
- `localVideoTrack`, `localAudioTrack`, `localScreenTrack`: raw `MediaStreamTrack`s.
- `isScreenSharing`, plus a ref mirror of it.
- `currentRoomNameRef`
- `userInfoMap`: `Map<userId, {name?, email}>`, built from server participant lists.
- `remoteUserTracks`: `Map<userId, RemoteUserTracks>`.

### Track extraction
- `extractRemoteTracks(participant)` (private) reads the Camera, Microphone and ScreenShare publications.
- It returns their `mediaStreamTrack`s together with the `hasVideo`, `hasAudio` and `hasScreenVideo` flags.
- `updateRemoteParticipant` writes that result into `remoteUserTracks`, keyed by `participant.identity`, and deliberately does not play audio.
- `updateLocalTracks(room)` does the same for the local participant and keeps `isScreenSharing` in sync with whether a screen track exists.

### Joining (socket listeners registered on mount)
`handleJoin` runs on `livekit:init-call` or `livekit:join-call`, whose payload is `{ serverUrl, token, roomName, meetingType?, participants? }`. It:
1. Ignores the event unless `data.roomName` starts with `community-stream:` (see Notes).
2. Merges `participants` into `userInfoMap`.
3. Disconnects any previous room.
4. Creates `new Room({ adaptiveStream: true, dynacast: true })`.
5. Wires up the room events:
   - `ParticipantConnected`, `TrackSubscribed`, `TrackUnsubscribed`, and `TrackMuted` / `TrackUnmuted` (remote participants only): refresh that remote participant.
   - `LocalTrackPublished` / `LocalTrackUnpublished`: refresh the local tracks.
   - `ParticipantDisconnected`: remove that participant.
   - `Disconnected`: log only.
6. Calls `room.connect(serverUrl, token)`, enables the microphone and then the camera, extracts the local tracks, and sets `inCall = true`.
7. If any step fails, it disconnects and sets `inCall = false`.

The other listeners:
- `handleLeave` (`livekit:leave-call`) calls `leaveCall()`, but only if the current room name starts with `community-stream:`.
- `handleParticipantsUpdate` (`livekit:participants-update`) merges names into `userInfoMap` when `roomName || channel` starts with `community-stream:`.

### Controls
- `leaveCall()`:
  - Calls `room.disconnect(true)`.
  - Emits `workspace:move-to-space` with `{spaceId: "lobby"}` and `livekit:screen-share-state` with `{isSharing: false}`.
  - Resets all state.
- `toggleMicrophone()` and `toggleCamera()` flip `setMicrophoneEnabled` / `setCameraEnabled`. Each returns the new enabled state, or `false` when there is no room.
- `toggleScreenShare()` calls `setScreenShareEnabled(true|false)` and emits `livekit:screen-share-state` with `{isSharing}`. When sharing starts, the screen track itself is picked up through `LocalTrackPublished`.

## Exports
- `useCommunityStreamLiveKit()` returns `{ localVideoTrack, localAudioTrack, localScreenTrack, inCall, isScreenSharing, leaveCall, toggleMicrophone, toggleCamera, toggleScreenShare, userInfoMap, remoteUserTracks }`.
- `RemoteUserTracks` (interface): `{ odId, cameraTrack, screenTrack, audioTrack: MediaStreamTrack | null, hasAudio, hasVideo }`.

## Interfaces
- **Socket.IO events:**
  - Listens for `livekit:init-call`, `livekit:join-call`, `livekit:leave-call` and `livekit:participants-update`.
  - Emits `workspace:move-to-space` and `livekit:screen-share-state`.
  - The server emits the call events from its `workspace:move-to-space` handler in `server/realtime/socket.ts` (around L3090-L3390), with `meetingType: 'community-stream'`.
- **External services:** the LiveKit SFU at the `serverUrl` sent by the backend (LiveKit cloud, `wss://lk.garage.app`). The JWT token is minted server-side.

## Dependencies
- **Internal:** `lib/socket.ts` (`connectSocket`).
- **Packages:** `livekit-client` (`Room`, `RoomEvent`, `Track` and the participant and publication types); `react`.

## Used by
- `components/community-stream/CommunityStreamOverlay.tsx` (the main consumer)
- `components/community-stream/useProximityAudio.ts` (imports the `RemoteUserTracks` type)
- `components/community-stream/index.ts`

## Notes
- **The room-name filter probably never matches.** The backend sets `roomName` to `toLivekitRoomName(spaceId)` (`server/services/livekit.ts`), which replaces every character outside `[A-Za-z0-9-_]` with `-`. The colon is replaced, so `community-stream:abc` becomes `community-stream-abc`. The original id is sent separately as `channel`.
  - Because `handleJoin` tests `data.roomName.startsWith("community-stream:")`, it appears to ignore every real join, and the overlay stays on "Connecting to stream...".
  - `useCommunityStream` checks `data.channel`, and `handleParticipantsUpdate` falls back to `channel`; both match correctly.
- The exposed tracks are raw `MediaStreamTrack`s. Consumers in this folder call Agora-style `.play(element)` on them, which does not exist on a `MediaStreamTrack` (see `CommunityStreamOverlay.tsx.md` and `useProximityAudio.ts.md`).
- `leaveCall` itself emits `workspace:move-to-space` to the lobby. When the overlay's leave button runs `leaveCall()` and then `onClose` (`leaveCommunityStream`), the lobby move is emitted twice.
- Remote participants are keyed by LiveKit `identity`, which is expected to be the user id that the backend puts in the token.
