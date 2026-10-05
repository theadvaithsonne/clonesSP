# `components/community-stream/index.ts`

> Barrel file that re-exports every public symbol of the Community Stream feature folder.

**Kind:** Barrel module · **Lines:** 9

## Purpose
Gives consumers a single import path, `@/components/community-stream`, for the Community Stream feature: a 2D "walk-around" video room. Inside it, users move avatars across a large virtual office floor and only hear people whose proximity circle overlaps theirs.

## How it works
The file contains only re-export statements. It has no logic of its own.

## Exports
- `export *` from `./types`: `CommunityStreamParticipant`, `CommunityStreamState` (interfaces).
- `useCommunityStream` from `./useCommunityStream`: join/leave state machine driven by `workspace:move-to-space`.
- `useCommunityStreamDaily` from `./useCommunityStreamDaily`: legacy Daily.co transport hook.
- `useCommunityStreamLiveKit` from `./useCommunityStreamLiveKit`: the LiveKit transport hook that the overlay uses.
- `useAvatarPositions`, `WORLD_WIDTH`, `WORLD_HEIGHT`, `RADIUS_CIRCLE_SIZE`, `AVATAR_SIZE` from `./useAvatarPositions`.
- `useProximityAudio` from `./useProximityAudio`.
- `CommunityStreamCard` from `./CommunityStreamCard`.
- `CommunityStreamOverlay` from `./CommunityStreamOverlay`.

## Dependencies
- **Internal:** all eight sibling modules listed above.

## Used by
- `components/dashboard/ChannelsPage.tsx`, which imports `useCommunityStream` and `CommunityStreamOverlay`.

## Notes
- Two different `RemoteUserTracks` interfaces exist in this folder (in `useCommunityStreamLiveKit.ts` and `useCommunityStreamDaily.ts`). Neither is re-exported here, so the barrel avoids a name clash.
- `CommunityStreamCard`, `useCommunityStreamDaily` and the world constants are re-exported, but no file outside this folder imports them through the barrel.
