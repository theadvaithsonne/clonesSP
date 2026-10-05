# `components/community-stream/types.ts`

> Shared TypeScript interfaces for Community Stream participants and the join/leave state.

**Kind:** Type definitions · **Lines:** 13

## Purpose
Holds the small data shapes that the Community Stream UI passes around. The file contains only types and emits no JavaScript at runtime.

## Exports
- `CommunityStreamParticipant`: `{ id: string; name?: string; email: string; profilePicture?: string }`. One person shown in a stream card's occupant list. The card shows `profilePicture` when it is set; otherwise it builds initials from `name` or `email`.
- `CommunityStreamState`: `{ isConnecting: boolean; channelId: string | null; channelTitle: string }`. Describes whether the user is joining or inside a stream, and which channel it is.

## Dependencies
None.

## Used by
- `components/community-stream/CommunityStreamCard.tsx` (uses `CommunityStreamParticipant`)
- `components/community-stream/index.ts` (`export *`)

## Notes
- `useCommunityStream.ts` declares its own private copy of the `CommunityStreamState` interface instead of importing this one. The two copies are identical today, but a change to one will not reach the other.
