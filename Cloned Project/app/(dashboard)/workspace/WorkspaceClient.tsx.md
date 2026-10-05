# `app/(dashboard)/workspace/WorkspaceClient.tsx`

> React component `WorkspaceClient`.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 6069 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Button`×34 (components/ui/button.tsx), `AnimatePresence`×16 (framer-motion), `X`×9 (lucide-react), `DailyVideoPlayer`×7 (app/(dashboard)/workspace/components/DailyVideoPlayer.tsx), `UserSpaceCard`×6 (app/(dashboard)/workspace/components/UserSpaceCard.tsx), `OfficeStreamSection`×4 (app/(dashboard)/workspace/components/OfficeStreamSection.tsx), `ScreenShare`×4 (lucide-react), `Minimize2`×3 (lucide-react), `Maximize2`×3 (lucide-react), `MicOff`×3 (lucide-react), `MessageSquare`×3 (lucide-react), `Building2`×2 (lucide-react), `ChevronDown`×2 (lucide-react), `AgentWorkspaceCard`×2 (local), `Users`×2 (lucide-react), `Mic`×2 (lucide-react), `VideoOff`×2 (lucide-react), `Video`×2 (lucide-react), `PhoneOff`×2 (lucide-react), `RecordingControls` (app/(dashboard)/workspace/components/RecordingControls.tsx), `DraggableCameraBubble` (app/(dashboard)/workspace/components/DraggableCameraBubble.tsx), `BookingDialog` (components/dashboard/BookingDialog.tsx), `HqRoomBookingModal` (components/dashboard/HqRoomBookingModal.tsx), `HqRoomSchedule` (components/dashboard/HqRoomSchedule.tsx), `DoorClosed` (lucide-react), `GripVertical` (lucide-react), `PictureInPicture2` (lucide-react), `Dialog` (components/ui/dialog.tsx), `DialogContent` (components/ui/dialog.tsx), `DialogHeader` (components/ui/dialog.tsx), `DialogTitle` (components/ui/dialog.tsx), `DialogDescription` (components/ui/dialog.tsx), `DialogFooter` (components/ui/dialog.tsx), `PeerAudio` (app/(dashboard)/workspace/components/PeerAudio.tsx), `Check` (lucide-react), `NetworkStatsCard` (app/(dashboard)/workspace/components/NetworkStatsCard.tsx), `EventCard` (app/(dashboard)/workspace/components/EventCard.tsx), `VideoElementWithEffect` (local), `FullscreenScreenShareVideo` (local), `Clock` (lucide-react), … +10 more

**Hooks used:** `useEffect`×60, `useState`×43, `useCallback`×22, `useMemo`×15, `useRef`×14, `useAmIFounder` (lib/hooks/useAmIFounder.ts), `useLiveKit` (lib/workspace-livekit-context.tsx), `useLocalMedia` (app/(dashboard)/workspace/hooks/useLocalMedia.ts), `useWebRTC` (app/(dashboard)/workspace/hooks/useWebRTC.ts), `useScreenShare` (app/(dashboard)/workspace/hooks/useScreenShare.ts), `useFloors` (app/(dashboard)/workspace/hooks/useFloors.ts), `useStatus` (app/(dashboard)/workspace/hooks/useStatus.ts), `useRecording` (app/(dashboard)/workspace/hooks/useRecording.ts), `useKnocking` (app/(dashboard)/workspace/hooks/useKnocking.ts), `useConnectionHealth` (app/(dashboard)/workspace/hooks/useConnectionHealth.ts)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (WorkspaceClient)` | component | `WorkspaceClient()` | 226 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/betty/time-tracking?orgId=${orgId}` (L831)
  - `GET /backend/events?orgId=${orgId}` (L855)
  - `GET /backend/room-bookings?orgId=${orgId}` (L1063)
  - `POST /backend/betty/clock-out?orgId=${orgId}` (L1124)
  - `POST /backend/betty/clock-in?orgId=${orgId}` (L1128)
  - `PATCH /backend/events/${eventId}/end?orgId=${orgId}` (L5716)
- **Socket.IO events:**
  - emits: `workspace:move-to-space`, `workspace:end-meeting`, `workspace:signal`, `renegotiation-accepted`, `workspace:knock-accept`, `workspace:join`, `workspace:request-sync`, `workspace:heartbeat`, `workspace:leave`
  - listens for: `event:created`, `event:started`, `event:ended`, `event:member-removed`, `event:members-updated`, `room-booking:created`, `room-booking:updated`, `room-booking:cancelled`, `room-booking:ended`, `room-booking:auto-kick`, `livekit:join-error`, `workspace:users`, `workspace:user-joined`, `workspace:user-left`, `workspace:user-moved-space`, `workspace:user-status-changed`, `workspace:join-space`, `workspace:knock-request`, `workspace:knock-accepted`, `workspace:knock-declined`, `workspace:knock-cancelled`, `workspace:knock-unreachable`, `workspace:knock-handled`, `livekit:call-answered-elsewhere`, `workspace:screen-share-state`, `workspace:user-recording-changed`, `livekit:screen-share-state`, `livekit:participants-update`, `livekit:init-call`, `livekit:join-call`, `workspace:presence-sync`, `workspace:join-confirmed`, `workspace:heartbeat-ack`
- **Environment variables (`process.env`):** `NEXT_PUBLIC_HQ_FORCE_RECORDING`
- **Browser storage / cookies:** `garage_org_id` (localStorage: get), `workspace` (sessionStorage: pending-knock/pending-knock/pending-knock-accept/pending-knock-accept), `garage_user_id` (localStorage: get)
- **Timers / queues:** `setTimeout` at L712, L736, L1684, L2210, L2772, …; `setInterval` at L922, L1084, L2790

## Dependencies

- **Internal:**
  - `components/ui/dialog.tsx` — `Dialog`, `DialogContent`, `DialogDescription`, `DialogFooter`, `DialogHeader`, `DialogTitle`
  - `components/ui/button.tsx` — `Button`
  - `components/ui/badge.tsx` — `Badge`
  - `lib/auth.ts` — `getUserIdFromToken`, `getToken`, `getOrgId`
  - `lib/hooks/useAmIFounder.ts` — `useAmIFounder`
  - `lib/socket.ts` — `connectSocket`
  - `lib/revenue-network-cache.ts` — `fetchAndCacheRevenueNetworkData`
  - `lib/utils.ts` — `cn`
  - `app/(dashboard)/workspace/components/EventCard.tsx` — `EventCard`
  - `app/(dashboard)/workspace/components/PeerAudio.tsx` — `PeerAudio`
  - `app/(dashboard)/workspace/components/UserSpaceCard.tsx` — `UserSpaceCard`
  - `app/(dashboard)/workspace/hooks/useLocalMedia.ts` — `useLocalMedia`
  - `app/(dashboard)/workspace/hooks/useWebRTC.ts` — `useWebRTC`
  - `lib/workspace-livekit-context.tsx` — `useWorkspaceLiveKit as useLiveKit`
  - `app/(dashboard)/workspace/hooks/useScreenShare.ts` — `useScreenShare`
  - `app/(dashboard)/workspace/hooks/useFloors.ts` — `useFloors`
  - `app/(dashboard)/workspace/hooks/useKnocking.ts` — `useKnocking`
  - `app/(dashboard)/workspace/hooks/useStatus.ts` — `useStatus`
  - `app/(dashboard)/workspace/hooks/useRecording.ts` — `useRecording`
  - `app/(dashboard)/workspace/hooks/useConnectionHealth.ts` — `useConnectionHealth`
  - `app/(dashboard)/workspace/components/RecordingControls.tsx` — `RecordingControls`
  - `app/(dashboard)/workspace/components/DraggableCameraBubble.tsx` — `DraggableCameraBubble`
  - `components/dashboard/TodoMenu.tsx` — `TodoMenu`
  - `components/dashboard/NotificationsHub.tsx` — `NotificationsHub (default)`
  - `components/dashboard/MobileActionSidebar.tsx` — `MobileActionSidebar (default)`
  - `app/(dashboard)/workspace/types.ts` — `PeerState`, `RoomBooking`
  - `app/(dashboard)/workspace/components/HqMeetingRoomCard.tsx` — `HqMeetingRoomCard`
  - `components/dashboard/HqRoomBookingModal.tsx` — `HqRoomBookingModal`
  - `components/dashboard/HqRoomSchedule.tsx` — `HqRoomSchedule`
  - `app/(dashboard)/workspace/utils.ts` — `getPreferredScreenTrack`, `isLiveCameraTrack`, `isScreenTrack`
  - `components/dashboard/BookingDialog.tsx` — `BookingDialog (default)`
  - `components/dashboard/OrganizationCabinetPage.tsx` — `OrganizationCabinetPage (default)`
  - `lib/api.ts` — `api`
  - `app/(dashboard)/workspace/components/DailyVideoPlayer.tsx` — `DailyVideoPlayer (default)`
  - `app/(dashboard)/workspace/components/WorkshopPreviewSection.tsx` — `WorkshopPreviewSection`
  - `app/(dashboard)/workspace/components/NetworkStatsCard.tsx` — `NetworkStatsCard`
  - `app/(dashboard)/workspace/components/CommunityDropdown.tsx` — `CommunityDropdown (default)`
  - `app/(dashboard)/workspace/components/OfficeStreamSection.tsx` — `OfficeStreamSection`
  - `lib/feed-api.ts` — `getChannelSubscribers`
- **Packages:**
  - `lucide-react` — `Bell`, `Building2`, `Check`, `CheckSquare`, `ChevronDown`, `CircleDot`, …
  - `react` — `useCallback`, `useEffect`, `useMemo`, `useRef`, `useState`
  - `framer-motion` — `AnimatePresence`, `motion`
  - `sonner` — `toast`

## Used by

- `app/(dashboard)/workspace/loader.tsx`

## Notes

- Large file (6069 lines) — read it by section; line numbers above point into it.
