# `components/office/VideoGrid.tsx`

> React component `VideoGrid`.

**Kind:** React component · **Lines:** 835 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `ParticipantTile`×8 (@livekit/components-react), `MicOff`×3 (lucide-react), `SpeakingBorderWrapper`×3 (local), `ScreenShare`×2 (lucide-react), `CameraTile`×2 (local), `ConnectionBars` (local), `BookHeadphones` (lucide-react), `ParticipantAvatar` (components/office/ParticipantAvatar.tsx), `PersistentConnectionBars` (local), `Loader2` (lucide-react), `SpeakingMicIndicator` (local), `UserX` (lucide-react), `LegacyVideoGrid` (local), `JustifiedTiles` (local)

### Props

- **`VideoGrid`**: `isHost?: boolean`, `isBackgroundProcessing?: boolean`, `hasScreenShare?: boolean`, `layout?: RoomLayout`

**Hooks used:** `useRef`×2, `useEffect`×2, `useState`×2, `useTracks`×2 (@livekit/components-react), `useMemo`×2, `useConnectionQualityIndicator` (@livekit/components-react), `useIsSpeaking` (@livekit/components-react), `useParticipants` (@livekit/components-react), `useSpeakingParticipants` (@livekit/components-react), `useVideoGrid` (hooks/office/useVideoGrid.ts)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `RoomLayout` | type |  | 327 |
| `isBotParticipant` | function | `isBotParticipant(participant: Participant): boolean` — The note-taker bot joins LiveKit as a real participant. | 336 |
| `default (VideoGrid)` | component | `VideoGrid({ isHost = false, onKickParticipant, onMuteParticipant, isB…)` | 579 |

## Interfaces

- **Timers / queues:** `setInterval` at L141

## Dependencies

- **Internal:**
  - `hooks/office/useVideoGrid.ts` — `useVideoGrid`
  - `lib/meet-metadata.ts` — `parseParticipantMeta`
  - `components/office/ParticipantAvatar.tsx` — `ParticipantAvatar`
- **Packages:**
  - `react` — `useEffect`, `useMemo`, `useRef`, `useState`
  - `livekit-client` — `Track`, `ConnectionQuality`, `Participant`
  - `@livekit/components-react` — `ParticipantTile`, `useTracks`, `useParticipants`, `useIsSpeaking`, `useSpeakingParticipants`, `useConnectionQualityIndicator`, …
  - `lucide-react` — `MicOff`, `UserX`, `ScreenShare`, `Loader2`, `BookHeadphones`

## Used by

- `app/meet/conference/[orgId]/[roomId]/ConferenceCallStandalone.tsx`
