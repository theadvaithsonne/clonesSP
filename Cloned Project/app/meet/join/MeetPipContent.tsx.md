# `app/meet/join/MeetPipContent.tsx`

> React component `MeetPipContent`.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 527 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `PipVideoTile`×2 (local), `PipAvatar` (local), `PipScreenShareTile` (local)

### Props

- **`MeetPipContent`**: `meetTitle: string`, `participants: PipParticipant[]`, `screenShare?: PipScreenShare | null`, `isMicMuted: boolean`, `isCameraOff: boolean`, `onToggleMic: () => void`, `onToggleCamera: () => void`, `onLeaveCall: () => void`

**Hooks used:** `useEffect`×3, `useRef`×2, `useState`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `PipParticipant` | interface |  | 4 |
| `PipScreenShare` | interface |  | 13 |
| `default (MeetPipContent)` | component | `MeetPipContent({ meetTitle, participants, screenShare, isMicMuted, isCamer…)` | 252 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:** none
- **Packages:**
  - `react` — `useEffect`, `useRef`, `useState`

## Used by

- `components/meet/PersistentPipRenderer.tsx`
