# `components/office/ControlBar.tsx`

> React component `ControlBar`.

**Kind:** React component · **Lines:** 733 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Popover`×6 (components/ui/popover.tsx), `PopoverTrigger`×6 (components/ui/popover.tsx), `PopoverContent`×6 (components/ui/popover.tsx), `DeviceList`×3 (local), `Square`×3 (lucide-react), `ChevronUp`×2 (lucide-react), `Check`×2 (lucide-react), `Link2`×2 (lucide-react), `Sparkles`×2 (lucide-react), `VirtualBackgroundPicker`×2 (components/office/VirtualBackgroundPicker.tsx), `PictureInPicture2`×2 (lucide-react), `CircleDot`×2 (lucide-react), `BookHeadphones`×2 (lucide-react), `Hand` (lucide-react), `Mic` (lucide-react), `MicLevelBars` (local), `MicOff` (lucide-react), `Video` (lucide-react), `VideoOff` (lucide-react), `ScreenShareOff` (lucide-react), `ScreenShare` (lucide-react), `Smile` (lucide-react), `Loader2` (lucide-react), `ShoppingBag` (lucide-react), `MoreVertical` (lucide-react), `PhoneOff` (lucide-react)

### Props

- **`ControlBar`**: `isHost?: boolean`, `isWebinar?: boolean`, `recording?: boolean`, `recordingLoading?: boolean`, `isPipSupported?: boolean`, `roomId?: string`, `connected?: boolean`, `backgroundType?: BackgroundType`, `backgroundImage?: string`, `isBackgroundProcessing?: boolean`

**Hooks used:** `useState`×3, `useCallback`×2, `useMultibandTrackVolume` (@livekit/components-react), `useMediaDeviceSelect` (@livekit/components-react), `useLocalParticipant` (@livekit/components-react), `useScreenShare` (hooks/office/useScreenShare.ts), `useRef`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (ControlBar)` | component | `ControlBar({ onLeave, isHost = false, isWebinar = false, recording = f…)` | 210 |

## Interfaces

- **Timers / queues:** `setTimeout` at L284

## Dependencies

- **Internal:**
  - `hooks/office/useScreenShare.ts` — `useScreenShare`
  - `components/ui/popover.tsx` — `Popover`, `PopoverContent`, `PopoverTrigger`
  - `components/office/VirtualBackgroundPicker.tsx` — `VirtualBackgroundPicker (default)`
  - `hooks/office/useEmojiReactions.ts` — `REACTION_EMOJIS`
  - `hooks/office/useVirtualBackground.ts` — `BackgroundType`, `(types only)`
  - `lib/api/garage.ts` — `fetchMyAffiliateId`
- **Packages:**
  - `react` — `useCallback`, `useState`, `useRef`, `useEffect`
  - `@livekit/components-react` — `useLocalParticipant`, `useMediaDeviceSelect`, `useMultibandTrackVolume`
  - `livekit-client` — `Track`, `LocalAudioTrack`
  - `framer-motion` — `motion`
  - `lucide-react` — `Mic`, `MicOff`, `Video`, `VideoOff`, `ScreenShare`, `ScreenShareOff`, …

## Used by

No other file imports this one and it has no automatic entry point — it appears unused (or is loaded dynamically by a path the import graph cannot see).
