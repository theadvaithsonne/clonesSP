# `app/(dashboard)/workspace/utils.ts`

> Module exporting `isScreenTrack`, `isLiveCameraTrack`, `getActiveScreenTrack`, `getActiveCameraTrack` and 2 more.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 66

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `isScreenTrack` | function | `isScreenTrack(track: MediaStreamTrack)` | 3 |
| `isLiveCameraTrack` | function | `isLiveCameraTrack(track: MediaStreamTrack)` | 14 |
| `getActiveScreenTrack` | function | `getActiveScreenTrack(stream?: MediaStream \| null)` | 21 |
| `getActiveCameraTrack` | function | `getActiveCameraTrack(stream?: MediaStream \| null)` | 32 |
| `buildSingleTrackStream` | function | `buildSingleTrackStream(track?: MediaStreamTrack \| null)` | 35 |
| `getPreferredScreenTrack` | function | `getPreferredScreenTrack(stream?: MediaStream \| null, assumeScreenShare?: boolean)` | 42 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:** none
- **Packages:** none

## Used by

- `app/(dashboard)/workspace/WorkspaceClient.tsx`
- `app/(dashboard)/workspace/components/FloorMeetingRoomCard.tsx`
- `app/(dashboard)/workspace/components/OccupantAvatar.tsx`
- `app/(dashboard)/workspace/components/OccupantAvatarSmall.tsx`
- `app/(dashboard)/workspace/components/ScreenShareCard.tsx`
- `app/(dashboard)/workspace/components/UserSpaceCard.tsx`
- `app/(dashboard)/workspace/hooks/useScreenShare.ts`
- `app/(dashboard)/workspace/hooks/useWebRTC.ts`
