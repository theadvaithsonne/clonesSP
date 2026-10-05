# `components/office/MeetSidebar.tsx`

> React component `MeetSidebar`.

**Kind:** React component · **Lines:** 1116 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Bot`×2 (lucide-react), `ParticipantAvatar`×2 (components/office/ParticipantAvatar.tsx), `Hand`×2 (lucide-react), `SidebarToggleRow`×2 (local), `MessageSquare`×2 (lucide-react), `Reply`×2 (lucide-react), `MicOff` (lucide-react), `UserX` (lucide-react), `Users` (lucide-react), `CircleDot` (lucide-react), `Mic` (lucide-react), `PanelRightClose` (lucide-react), `HostControlsBlock` (local), `ParticipantRow` (local), `ChatRow` (local), `X` (lucide-react), `Smile` (lucide-react), `Send` (lucide-react)

### Props

- **`MeetSidebar`**: `isOpen: boolean`, `isHost: boolean`, `pendingRequests?: PendingPermissionRequest[]`, `raisedHands?: Set<string>`, `accessPolicy?: { allowUnmute: boolean; allowPresent: boolean }`, `recordingsSlot?: React.ReactNode`, `memosSlot?: React.ReactNode`, `chatMessages: ReceivedChatMessage[]`, `isSending: boolean`, `unreadCount: number`, `activeTab?: SidebarTab`

**Hooks used:** `useState`×8, `useEffect`×5, `useRef`×3, `useMemo`×3, `useIsSpeaking` (@livekit/components-react), `useParticipants` (@livekit/components-react), `useLocalParticipant` (@livekit/components-react)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `PendingPermissionRequest` | interface |  | 95 |
| `default (MeetSidebar)` | component | `MeetSidebar({ isOpen, onClose, isHost, onKick, onMute, pendingRequests,…)` | 360 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/meet-metadata.ts` — `parseParticipantMeta`
  - `lib/linkify.tsx` — `linkifyText`
  - `components/office/ParticipantAvatar.tsx` — `ParticipantAvatar`
- **Packages:**
  - `react` — `useState`, `useRef`, `useEffect`, `useMemo`
  - `lucide-react` — `Users`, `MessageSquare`, `Send`, `UserX`, `Mic`, `MicOff`, …
  - `@livekit/components-react` — `useParticipants`, `useIsSpeaking`, `useLocalParticipant`, `ReceivedChatMessage`
  - `livekit-client` — `Track`, `Participant`

## Used by

- `app/meet/conference/[orgId]/[roomId]/ConferenceCallStandalone.tsx`
