# `components/community-stream/useCommunityStreamDaily.ts`

> Legacy Daily.co version of the Community Stream media hook. It joins a Daily call object when the backend emits `daily:*` events for a `community-stream:` room. The LiveKit hook has replaced it, and the backend no longer emits those events.

**Kind:** React hook (client) · **Lines:** 330

## Purpose
Before the platform moved to LiveKit, Community Stream media ran on Daily.co. This hook mirrors `useCommunityStreamLiveKit` almost exactly (same return shape, same proximity-friendly "do not auto-play remote audio" rule), but it is built on `@daily-co/daily-js` call objects. It is kept and re-exported, but nothing calls it.

## How it works
### Track extraction
- `extractTracks(participant)` (private) reads `participant.tracks`.
- Video and screen video count as present only when their `state === "playable"`, and the hook then uses their `persistentTrack`.
- The audio track is always taken from `persistentTrack`. `hasAudio` reflects whether it is playable.

### State
The state is the same as the LiveKit hook, except that it holds a `callObjectRef` (a `DailyCall`) in place of a `Room`.

### Joining
`handleJoin` runs on `daily:init-call` or `daily:join-call`, whose payload is `{ roomUrl, token, roomName, meetingType?, participants? }`. It:
1. Ignores the event unless `roomName` starts with `community-stream:`.
2. Merges `participants` into `userInfoMap`.
3. Leaves and destroys any previous call object.
4. Creates `DailyIframe.createCallObject({ audioSource: true, videoSource: true })`.
5. Subscribes to call events:
   - `participant-joined` (remote participants only): records the participant's tracks.
   - `participant-updated`: refreshes the local or remote tracks.
   - `participant-left`: removes the participant by `user_id`, falling back to `session_id`.
6. Runs `join({ url: roomUrl, token })`, extracts the local tracks, and sets `inCall = true`.

The other listeners:
- `daily:leave-call` calls `leaveCall()`, but only while the current room is a community stream.
- `daily:participants-update` merges names into `userInfoMap`.

### Controls
- `leaveCall()` runs `leave()` and then `destroy()` on the call object, emits `workspace:move-to-space` with `{spaceId: "lobby"}` and `daily:screen-share-state` with `{isSharing: false}`, and resets all state.
- `toggleMicrophone()` and `toggleCamera()` read `participants().local.audio` / `.video` and call `setLocalAudio` / `setLocalVideo` with the inverse. Each returns the new state.
- `toggleScreenShare()` calls `startScreenShare()` or `stopScreenShare()` and emits `daily:screen-share-state`.

## Exports
- `useCommunityStreamDaily()` returns `{ localVideoTrack, localAudioTrack, localScreenTrack, inCall, isScreenSharing, leaveCall, toggleMicrophone, toggleCamera, toggleScreenShare, userInfoMap, remoteUserTracks }`.
- `RemoteUserTracks` (interface): the same shape as the one in `useCommunityStreamLiveKit.ts`, but declared separately.

## Interfaces
- **Socket.IO events:**
  - Listens for `daily:init-call`, `daily:join-call`, `daily:leave-call` and `daily:participants-update`.
  - Emits `workspace:move-to-space` and `daily:screen-share-state`.
- **External services:** Daily.co. The room URL and meeting token would be supplied by the backend.

## Dependencies
- **Internal:** `lib/socket.ts` (`connectSocket`).
- **Packages:** `@daily-co/daily-js` (`DailyIframe.createCallObject` and the Daily types); `react`.

## Used by
- Only `components/community-stream/index.ts`, which re-exports it. No component calls `useCommunityStreamDaily`.

## Notes
- **Dead code.** `server/realtime/socket.ts` neither emits nor handles any `daily:*` event. The backend sets up community streams through LiveKit, so even if a component mounted this hook, it would never connect.
- Keeping it still pulls `@daily-co/daily-js` into the dependency graph wherever the barrel `index.ts` is imported. Whether the bundler tree-shakes the unused hook was not checked.
- On a join error, `callObjectRef` is cleared without calling `destroy()` on the half-created call object.
