# `app/(dashboard)/workspace/types.ts`

> Statuses a user can pick for themselves from the UI.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 87

<!-- docgen:auto -->

## Purpose
Statuses a user can pick for themselves from the UI.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `SettableUserStatus` | type |  | 4 |
| `UserStatus` | type |  | 10 |
| `PeerState` | type |  | 12 |
| `KnockRequest` | type |  | 30 |
| `TodoNotification` | type |  | 35 |
| `FloorMember` | type |  | 42 |
| `RoomBooking` | type |  | 50 |
| `Floor` | type |  | 73 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:** none
- **Packages:** none

## Used by

- `app/(dashboard)/workspace/WorkspaceClient.tsx`
- `app/(dashboard)/workspace/components/FloorMeetingRoomCard.tsx`
- `app/(dashboard)/workspace/components/HqMeetingRoomCard.tsx`
- `app/(dashboard)/workspace/components/OccupantAvatar.tsx`
- `app/(dashboard)/workspace/components/OccupantAvatarSmall.tsx`
- `app/(dashboard)/workspace/components/PeerAudio.tsx`
- `app/(dashboard)/workspace/components/ScreenShareCard.tsx`
- `app/(dashboard)/workspace/components/UserSpaceCard.tsx`
- `app/(dashboard)/workspace/hooks/useFloors.ts`
- `app/(dashboard)/workspace/hooks/useKnocking.ts`
- `app/(dashboard)/workspace/hooks/useRecording.ts`
- `app/(dashboard)/workspace/hooks/useScreenShare.ts`
- `app/(dashboard)/workspace/hooks/useStatus.ts`
- `app/(dashboard)/workspace/hooks/useTodoNotifications.ts`
- `app/(dashboard)/workspace/hooks/useWebRTC.ts`
- `components/dashboard/BookingDialog.tsx`
- `components/dashboard/ConferenceRoomPage.tsx`
- `components/dashboard/HqRoomSchedule.tsx`
