# `components/livekit/ControlBar.tsx`

> React component `ControlBar`.

**Kind:** React component · **Lines:** 411 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `DeviceList`×3 (local), `Square`×3 (lucide-react), `Popover`×2 (components/ui/popover.tsx), `PopoverTrigger`×2 (components/ui/popover.tsx), `ChevronUp`×2 (lucide-react), `PopoverContent`×2 (components/ui/popover.tsx), `Check`×2 (lucide-react), `Link2`×2 (lucide-react), `PictureInPicture2`×2 (lucide-react), `Users`×2 (lucide-react), `CircleDot`×2 (lucide-react), `Mic` (lucide-react), `MicOff` (lucide-react), `Video` (lucide-react), `VideoOff` (lucide-react), `ScreenShareOff` (lucide-react), `ScreenShare` (lucide-react), `MessageSquare` (lucide-react), `Loader2` (lucide-react), `MoreVertical` (lucide-react), `PhoneOff` (lucide-react)

### Props

- **`ControlBar`**: `isHost?: boolean`, `recording?: boolean`, `recordingLoading?: boolean`, `isChatOpen?: boolean`, `unreadChatCount?: number`, `showParticipants?: boolean`, `isPipSupported?: boolean`, `pipActive?: boolean`, `roomId?: string`, `connected?: boolean`

**Hooks used:** `useState`×2, `useCallback`×2, `useMediaDeviceSelect` (@livekit/components-react), `useLocalParticipant` (@livekit/components-react), `useScreenShare` (hooks/livekit/useScreenShare.ts), `useRef`, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (ControlBar)` | component | `ControlBar({ onLeave, isHost = false, recording = false, recordingLoad…)` | 92 |

## Interfaces

- **Timers / queues:** `setTimeout` at L128

## Dependencies

- **Internal:**
  - `hooks/livekit/useScreenShare.ts` — `useScreenShare`
  - `components/ui/popover.tsx` — `Popover`, `PopoverContent`, `PopoverTrigger`
- **Packages:**
  - `react` — `useCallback`, `useState`, `useRef`, `useEffect`
  - `@livekit/components-react` — `useLocalParticipant`, `useMediaDeviceSelect`
  - `framer-motion` — `motion`
  - `lucide-react` — `Mic`, `MicOff`, `Video`, `VideoOff`, `ScreenShare`, `ScreenShareOff`, …

## Used by

No other file imports this one and it has no automatic entry point — it appears unused (or is loaded dynamically by a path the import graph cannot see).
