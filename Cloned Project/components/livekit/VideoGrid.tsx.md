# `components/livekit/VideoGrid.tsx`

> React component `VideoGrid`.

**Kind:** React component · **Lines:** 325 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `ParticipantTile`×10 (@livekit/components-react), `SpeakingBorderWrapper`×4 (local), `MicOff`×2 (lucide-react), `ScreenShare`×2 (lucide-react), `UserX` (lucide-react), `LegacyVideoGrid` (local)

### Props

- **`VideoGrid`**: `isHost?: boolean`, `hasScreenShare?: boolean`, `layout?: RoomLayout`

**Hooks used:** `useTracks`×2 (@livekit/components-react), `useIsSpeaking` (@livekit/components-react), `useParticipants` (@livekit/components-react), `useVideoGrid` (hooks/livekit/useVideoGrid.ts)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `RoomLayout` | type |  | 10 |
| `default (VideoGrid)` | component | `VideoGrid({ isHost = false, onKickParticipant, onMuteParticipant, has…)` | 148 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `hooks/livekit/useVideoGrid.ts` — `useVideoGrid`
- **Packages:**
  - `livekit-client` — `Track`, `Participant`
  - `@livekit/components-react` — `ParticipantTile`, `useTracks`, `useParticipants`, `useIsSpeaking`, `TrackReferenceOrPlaceholder`
  - `lucide-react` — `MicOff`, `UserX`, `ScreenShare`

## Used by

No other file imports this one and it has no automatic entry point — it appears unused (or is loaded dynamically by a path the import graph cannot see).
