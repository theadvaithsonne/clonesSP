# `components/dashboard/ConferenceRoomPage.tsx`

> React component `ConferenceRoomPage`.

**Kind:** React component · **Lines:** 2363 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `DailyVideoPlayer`×5 (app/(dashboard)/workspace/components/DailyVideoPlayer.tsx), `Loader2`×5 (lucide-react), `ChevronDown`×3 (lucide-react), `Plus`×3 (lucide-react), `X`×3 (lucide-react), `ScreenShare`×2 (lucide-react), `Mic`×2 (lucide-react), `Calendar`×2 (lucide-react), `Clock`×2 (lucide-react), `AlertTriangle`×2 (lucide-react), `ChevronRight`×2 (lucide-react), `Info`×2 (lucide-react), `Button`×2 (components/ui/button.tsx), `MicOff` (lucide-react), `VideoOff` (lucide-react), `Video` (lucide-react), `ScreenShareOff` (lucide-react), `Square` (lucide-react), `CircleDot` (lucide-react), `StickyNote` (lucide-react), `PhoneOff` (lucide-react), `ConferenceMemoPanel` (components/dashboard/ConferenceMemoPanel.tsx), `Users` (lucide-react), `Check` (lucide-react), `Bell` (lucide-react), `Trash2` (lucide-react), `Copy` (lucide-react), `ExternalLink` (lucide-react), `HqMeetingRoomCard` (app/(dashboard)/workspace/components/HqMeetingRoomCard.tsx), `ChevronLeft` (lucide-react), `HqRoomSchedule` (components/dashboard/HqRoomSchedule.tsx)

### Props

- **`ConferenceRoomPage`**: `setActivePopover: (popover: string | null) => void`

**Hooks used:** `useState`×40, `useMemo`×15, `useEffect`×10, `useCallback`×9, `useRef`×2, `useRouter` (next/navigation), `useAmIFounder` (lib/hooks/useAmIFounder.ts), `useLiveKit` (lib/workspace-livekit-context.tsx)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (ConferenceRoomPage)` | component | `ConferenceRoomPage({ setActivePopover }: ConferenceRoomPageProps)` | 58 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/team/list?orgId=${orgId}` (L271)
  - `GET /backend/room-bookings?orgId=${orgId}&startDate=${dayStart.toISOString()}&endDate=${dayEnd.toISOString()}` (L292)
  - `POST /backend/room-bookings?orgId=${orgId}` (L414)
  - `GET /backend/room-bookings?orgId=${orgId}` (L472)
  - `GET /backend/conference-rooms?orgId=${orgId}` (L497)
  - `POST /backend/conference-rooms?orgId=${orgId}` (L517)
  - `DELETE /backend/conference-rooms/${cancelTargetRoom._id}?orgId=${orgId}` (L561)
- **Socket.IO events:**
  - emits: `workspace:join`, `workspace:move-to-space`
  - listens for: `room-booking:created`, `room-booking:updated`, `room-booking:cancelled`, `room-booking:ended`, `workspace:users`, `workspace:user-joined`, `workspace:user-left`, `workspace:user-moved-space`, `workspace:presence-sync`
- **Browser storage / cookies:** `garage_org_id` (localStorage: get)
- **Timers / queues:** `setInterval` at L146, L597; `setTimeout` at L892

## Dependencies

- **Internal:**
  - `lib/api.ts` — `api`
  - `lib/auth.ts` — `getToken`, `getUserIdFromToken`
  - `lib/socket.ts` — `connectSocket`
  - `app/(dashboard)/workspace/types.ts` — `PeerState`, `RoomBooking`
  - `app/(dashboard)/workspace/components/HqMeetingRoomCard.tsx` — `HqMeetingRoomCard`
  - `components/dashboard/HqRoomSchedule.tsx` — `HqRoomSchedule`
  - `lib/workspace-livekit-context.tsx` — `useWorkspaceLiveKit as useLiveKit`
  - `app/(dashboard)/workspace/components/DailyVideoPlayer.tsx` — `DailyVideoPlayer (default)`
  - `components/dashboard/ConferenceMemoPanel.tsx` — `ConferenceMemoPanel (default)`
  - `lib/utils.ts` — `cn`
  - `components/ui/button.tsx` — `Button`
  - `components/ui/input.tsx` — `Input`
  - `components/ui/label.tsx` — `Label`
  - `lib/hooks/useAmIFounder.ts` — `useAmIFounder`
- **Packages:**
  - `react` — `useEffect`, `useState`, `useMemo`, `useCallback`, `useRef`
  - `next` — `useRouter`
  - `sonner` — `toast`
  - `framer-motion` — `motion`
  - `lucide-react` — `Mic`, `MicOff`, `Video`, `VideoOff`, `ScreenShare`, `ScreenShareOff`, …

## Used by

- `app/(dashboard)/layout.tsx`

## Notes

- Large file (2363 lines) — read it by section; line numbers above point into it.
