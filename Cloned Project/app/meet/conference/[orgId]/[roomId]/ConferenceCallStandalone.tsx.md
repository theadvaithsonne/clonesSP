# `app/meet/conference/[orgId]/[roomId]/ConferenceCallStandalone.tsx`

> React component `ConferenceCallStandalone`.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 1992 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Labeled`×11 (local), `Loader2`×6 (lucide-react), `ControlIconToggle`×3 (local), `Mic`×2 (lucide-react), `MicOff`×2 (lucide-react), `DeviceMenu`×2 (components/office/DeviceMenu.tsx), `Video`×2 (lucide-react), `VideoOff`×2 (lucide-react), `Minimize2`×2 (lucide-react), `Square`×2 (lucide-react), `CircleDot`×2 (lucide-react), `Check`×2 (lucide-react), `Copy`×2 (lucide-react), `PipMirror`×2 (local), `PreJoinToggle`×2 (local), `PreJoinLobby` (local), `LiveKitRoom` (@livekit/components-react), `InCallView` (local), `RoomAudioRenderer` (@livekit/components-react), `CopilotProvider` (lib/copilot/context.tsx), `MeetHeader` (components/office/MeetHeader.tsx), `VideoGrid` (components/office/VideoGrid.tsx), `EmojiReactionOverlay` (components/office/EmojiReactionOverlay.tsx), `LocalMicLevelBars` (local), `ScreenShareOff` (lucide-react), `ScreenShare` (lucide-react), `VirtualBackgroundPicker` (components/office/VirtualBackgroundPicker.tsx), `Sparkles` (lucide-react), `Smile` (lucide-react), `Hand` (lucide-react), `DoorOpen` (lucide-react), `PhoneOff` (lucide-react), `MeetSidebar` (components/office/MeetSidebar.tsx), `RecordingsPanel` (components/office/RecordingsPanel.tsx), `MemosPanel` (components/office/MemosPanel.tsx), `KickDialog` (components/office/KickDialog.tsx), `AccessControlModal` (components/office/AccessControlModal.tsx), `MicLevelBars` (local), `Bot` (lucide-react), `VideoTrack` (@livekit/components-react), … +1 more

### Props

- **`ConferenceCallStandalone`**: `orgId: string`, `roomId: string`

**Hooks used:** `useState`×27, `useCallback`×27, `useEffect`×11, `useRef`×6, `useParticipants`×3 (@livekit/components-react), `useRecording`×2 (hooks/office/useRecording.ts), `useLocalParticipant`×2 (@livekit/components-react), `useRouter` (next/navigation), `useMemo`, `useCallTimer` (hooks/office/useCallTimer.ts), `useHostControls` (hooks/office/useHostControls.ts), `useAccessControl` (hooks/office/useAccessControl.ts), `useConferenceRecordings` (hooks/office/useConferenceRecordings.ts), `useHandRaise` (hooks/office/useHandRaise.ts), `useMemoRecorder` (hooks/office/useMemoRecorder.ts), `useVoiceMemos` (hooks/office/useVoiceMemos.ts), `useVirtualBackground` (hooks/office/useVirtualBackground.ts), `useMeetChat` (hooks/office/useMeetChat.ts), `useEmojiReactions` (hooks/office/useEmojiReactions.ts), `useMultibandTrackVolume` (@livekit/components-react), `useTracks` (@livekit/components-react)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (ConferenceCallStandalone)` | component | `ConferenceCallStandalone({ orgId, roomId, }: { orgId: string; roomId: string; })` | 117 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/conference-rooms?orgId=${orgId}` (L155)
  - `POST /backend/livekit/end-meeting` (L668)
  - `POST /backend/livekit/notetaker/${action}` (L1509)
- **Socket.IO events:**
  - emits: `workspace:move-to-space`, `workspace:join`
  - listens for: `livekit:init-call`, `livekit:join-call`, `livekit:join-error`, `livekit:call-answered-elsewhere`, `workspace:join-confirmed`
- **Environment variables (`process.env`):** `NEXT_PUBLIC_API_URL`
- **Timers / queues:** `setTimeout` at L268, L313; `setInterval` at L724

## Dependencies

- **Internal:**
  - `lib/api.ts` — `api`
  - `lib/auth.ts` — `getToken`, `getUserIdFromToken`
  - `lib/socket.ts` — `connectSocket`
  - `lib/chat-markers.ts` — `OFFICE_CONFERENCE_ROOM_ID`
  - `components/office/VideoGrid.tsx` — `VideoGrid (default)`
  - `components/office/MeetSidebar.tsx` — `MeetSidebar (default)`
  - `components/office/EmojiReactionOverlay.tsx` — `EmojiReactionOverlay (default)`
  - `hooks/office/useMeetChat.ts` — `useMeetChat`
  - `hooks/office/useEmojiReactions.ts` — `useEmojiReactions`, `REACTION_EMOJIS`
  - `hooks/office/useCallTimer.ts` — `useCallTimer`
  - `hooks/office/useRecording.ts` — `useRecording`
  - `hooks/office/useHostControls.ts` — `useHostControls`
  - `hooks/office/useVirtualBackground.ts` — `useVirtualBackground`
  - `hooks/office/useAccessControl.ts` — `useAccessControl`
  - `hooks/office/useAccessControl.ts` — `AccessPolicy`, `(types only)`
  - `hooks/office/useConferenceRecordings.ts` — `useConferenceRecordings`
  - `hooks/office/useHandRaise.ts` — `useHandRaise`
  - `hooks/office/useMemoRecorder.ts` — `useMemoRecorder`
  - `hooks/office/useVoiceMemos.ts` — `useVoiceMemos`
  - `components/office/KickDialog.tsx` — `KickDialog (default)`
  - `components/office/MeetHeader.tsx` — `MeetHeader (default)`
  - `components/office/VirtualBackgroundPicker.tsx` — `VirtualBackgroundPicker (default)`
  - `components/office/AccessControlModal.tsx` — `AccessControlModal (default)`
  - `components/office/RecordingsPanel.tsx` — `RecordingsPanel (default)`
  - `components/office/MemosPanel.tsx` — `MemosPanel (default)`
  - `components/office/DeviceMenu.tsx` — `DeviceMenu (default)`
  - `lib/copilot/context.tsx` — `CopilotProvider`
  - `lib/utils.ts` — `cn`
- **Packages:**
  - `react` — `useCallback`, `useEffect`, `useMemo`, `useRef`, `useState`
  - `react-dom` — `createPortal`
  - `next` — `useRouter`
  - `@livekit/components-react` — `LiveKitRoom`, `RoomAudioRenderer`, `useLocalParticipant`, `useMultibandTrackVolume`, `useParticipants`, `VideoTrack`, …
  - `livekit-client` — `LocalAudioTrack`, `Track`
  - `@livekit/components-styles`
  - `lucide-react` — `Mic`, `MicOff`, `Video`, `VideoOff`, `ScreenShare`, `ScreenShareOff`, …
  - `sonner` — `toast`

## Used by

- `app/meet/conference/[orgId]/[roomId]/page.tsx`

## Notes

- Large file (1992 lines) — read it by section; line numbers above point into it.
