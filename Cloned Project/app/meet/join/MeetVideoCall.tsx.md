# `app/meet/join/MeetVideoCall.tsx`

> React component `MeetVideoCall`.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 1495 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Button`×18 (components/ui/button.tsx), `DailyVideoPlayer`×8 (app/(dashboard)/workspace/components/DailyVideoPlayer.tsx), `ScreenShare`×6 (lucide-react), `Check`×5 (lucide-react), `PictureInPicture2`×3 (lucide-react), `MicOff`×3 (lucide-react), `MessageSquare`×3 (lucide-react), `Square`×3 (lucide-react), `Video`×2 (lucide-react), `Mic`×2 (lucide-react), `UserX`×2 (lucide-react), `Popover`×2 (components/ui/popover.tsx), `PopoverTrigger`×2 (components/ui/popover.tsx), `ChevronUp`×2 (lucide-react), `PopoverContent`×2 (components/ui/popover.tsx), `Link2`×2 (lucide-react), `Users`×2 (lucide-react), `CircleDot`×2 (lucide-react), `Play` (lucide-react), `VideoOff` (lucide-react), `ScreenShareOff` (lucide-react), `MoreVertical` (lucide-react), `PhoneOff` (lucide-react), `MeetAttendancePanel` (app/meet/join/MeetAttendancePanel.tsx), `X` (lucide-react), `Send` (lucide-react), `AlertDialog` (components/ui/alert-dialog.tsx), `AlertDialogContent` (components/ui/alert-dialog.tsx), `AlertDialogHeader` (components/ui/alert-dialog.tsx), `AlertDialogTitle` (components/ui/alert-dialog.tsx), `AlertDialogDescription` (components/ui/alert-dialog.tsx), `AlertDialogFooter` (components/ui/alert-dialog.tsx), `AlertDialogCancel` (components/ui/alert-dialog.tsx), `Loader2` (lucide-react)

### Props

- **`MeetVideoCall`**: `displayName: string`, `meetTitle: string`, `isHost: boolean`, `joinCode: string`, `participantId: string`, `affiliateId?: string`

**Hooks used:** `useState`×14, `useEffect`×11, `useCallback`×4, `useRef`×2, `useRouter` (next/navigation), `useMeeting` (lib/meeting-context.tsx), `usePip` (components/meet/PersistentPipRenderer.tsx), `useMemo`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (MeetVideoCall)` | component | `MeetVideoCall({ displayName, meetTitle, isHost, joinCode, participantId, …)` | 55 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/public/meet/participants?code=${joinCode}` (L154)
  - `POST /backend/public/meet/start` (L268)
  - `POST /backend/public/meet/end` (L313)
  - `POST /backend/public/meet/leave` (L339)
  - `POST /backend/public/meet/screen-share/start` (L403)
  - `POST /backend/public/meet/screen-share/stop` (L421)
  - `POST /backend/public/meet/kick` (L499)
- **Environment variables (`process.env`):** `NEXT_PUBLIC_API_URL`
- **Browser storage / cookies:** `meet_status` (sessionStorage: get/set/remove), `meet_livekit_server_url` (sessionStorage: get/set/remove), `meet_livekit_token` (sessionStorage: get/set/remove), `meet_livekit_room_name` (sessionStorage: get/set/remove), `meet_jwt` (sessionStorage: remove), `meet_id` (sessionStorage: remove), `meet_display_name` (sessionStorage: remove), `meet_join_code` (sessionStorage: remove), `meet_is_host` (sessionStorage: remove), `meet_participant_id` (sessionStorage: remove)
- **Timers / queues:** `setInterval` at L237; `setTimeout` at L391, L465

## Dependencies

- **Internal:**
  - `components/ui/button.tsx` — `Button`
  - `app/(dashboard)/workspace/components/DailyVideoPlayer.tsx` — `DailyVideoPlayer (default)`
  - `app/meet/join/MeetAttendancePanel.tsx` — `MeetAttendancePanel (default)`
  - `lib/meeting-context.tsx` — `useMeeting`
  - `components/meet/PersistentPipRenderer.tsx` — `usePip`
  - `components/ui/popover.tsx` — `Popover`, `PopoverTrigger`, `PopoverContent`
  - `components/ui/alert-dialog.tsx` — `AlertDialog`, `AlertDialogContent`, `AlertDialogHeader`, `AlertDialogTitle`, `AlertDialogDescription`, `AlertDialogFooter`, `AlertDialogCancel`
  - `lib/utils.ts` — `cn`
- **Packages:**
  - `react` — `useState`, `useEffect`, `useCallback`, `useRef`, `useMemo`
  - `next` — `useRouter`
  - `lucide-react` — `CircleDot`, `Mic`, `MicOff`, `MessageSquare`, `Video`, `VideoOff`, …
  - `sonner` — `toast`
  - `framer-motion` — `motion`

## Used by

- `app/meet/join/page.tsx`
