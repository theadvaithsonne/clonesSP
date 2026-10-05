# `components/community-stream/useCommunityStream.ts`

> React hook that joins or leaves a channel's Community Stream by moving the user's workspace "space" over Socket.IO, and tracks the connecting/connected state.

**Kind:** React hook (client) · **Lines:** 93

## Purpose
A Community Stream is modelled on the backend as a workspace space whose id is `community-stream:<channelId>`. This hook is the high-level switch the channel UI uses:
- To join, it tells the server the user moved into that space.
- The server then sets up the LiveKit room and emits `livekit:init-call` / `livekit:join-call`.
- `useCommunityStreamLiveKit` picks up those events and actually connects to the media room.

## How it works
- State (`CommunityStreamState`, a local copy of the interface in `types.ts`): `{ isConnecting, channelId, channelTitle }`.
- `joinCommunityStream(channelId, channelTitle)`:
  1. Sets `isConnecting: true` and records the channel.
  2. Emits `workspace:move-to-space` with `{ spaceId: "community-stream:<channelId>" }` on the shared socket from `connectSocket()`.
- `leaveCommunityStream()`:
  1. Emits `workspace:move-to-space` with `{ spaceId: "lobby" }`.
  2. Resets the state.
  - The server answers a move back to the lobby by emitting `livekit:leave-call` to the user. It also deletes the user's avatar position and broadcasts `community-stream:user-left` to the channel room. See `server/realtime/socket.ts` near L2877-L2935.
- While a `channelId` is set, an effect subscribes to:
  - `livekit:init-call` and `livekit:join-call`: if `data.channel` starts with `community-stream:`, it clears `isConnecting`.
  - `livekit:leave-call`: resets the state entirely. This also fires for a leave that the server emits for any other call type.
- The listeners are removed on cleanup and are re-registered whenever `channelId` changes.

## Exports
- `useCommunityStream(userId: string)` returns:
  - `streamState`: the current `{ isConnecting, channelId, channelTitle }`.
  - `joinCommunityStream(channelId, channelTitle)`
  - `leaveCommunityStream()`
  - `isInStream`: `!!streamState.channelId`

## Interfaces
- **Socket.IO events:**
  - Emits `workspace:move-to-space`.
  - Listens for `livekit:init-call`, `livekit:join-call` and `livekit:leave-call`.

## Dependencies
- **Internal:** `lib/socket.ts` (`connectSocket`, the Socket.IO singleton).
- **Packages:** `react`.

## Used by
- `components/community-stream/index.ts`
- `components/dashboard/ChannelsPage.tsx`. When `isInStream` is true, it renders `CommunityStreamOverlay` in place of the channel view, with `onClose={leaveCommunityStream}`.

## Notes
- The `userId` parameter is accepted but never used.
- Nothing in the project calls `joinCommunityStream` (ChannelsPage destructures it but never invokes it). As shipped, the UI therefore has no path into a Community Stream.
- `handleLeaveCall` reads `streamState.channelId` from the closure. This is safe only because the effect is re-created whenever `channelId` changes.
