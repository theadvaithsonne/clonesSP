# `components/office/MeetHeader.tsx`

> React component `MeetHeader`.

**Kind:** React component · **Lines:** 437 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Loader2`×2 (lucide-react), `Bot` (lucide-react), `CopilotToggle` (local), `Minimize2` (lucide-react), `PanelRight` (lucide-react), `Square` (lucide-react), `Sparkles` (lucide-react)

### Props

- **`MeetHeader`**: `roomId: string`, `roomName: string`, `meetingTitle?: string`, `meetingStartedAt?: string`, `connected: boolean`, `isHost: boolean`, `isMeetingHost?: boolean`, `recording: boolean`, `recElapsed: number`, `isPipSupported: boolean`, `sidebarOpen?: boolean`, `unreadChatCount?: number`

**Hooks used:** `useEffect`×6, `useState`×4, `useRoomContext`×2 (@livekit/components-react), `useRef`, `useCallElapsed` (local), `useParticipants` (@livekit/components-react), `useCopilot` (lib/copilot/context.tsx)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (MeetHeader)` | component | `MeetHeader({ roomId, roomName, meetingTitle, meetingStartedAt, connect…)` | 90 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `POST /backend/livekit/notetaker/${action}` (L235)
- **Environment variables (`process.env`):** `NEXT_PUBLIC_API_URL`
- **External hosts mentioned in the code:** `backend.networkchains.com`

## Dependencies

- **Internal:**
  - `lib/auth.ts` — `getToken`
  - `lib/copilot/context.tsx` — `useCopilot`
- **Packages:**
  - `react` — `useEffect`, `useRef`, `useState`
  - `lucide-react` — `PanelRight`, `Bot`, `Loader2`, `Sparkles`, `Square`, `Minimize2`
  - `@livekit/components-react` — `useParticipants`, `useRoomContext`
  - `livekit-client` — `RoomEvent`
  - `sonner` — `toast`

## Used by

- `app/meet/conference/[orgId]/[roomId]/ConferenceCallStandalone.tsx`
