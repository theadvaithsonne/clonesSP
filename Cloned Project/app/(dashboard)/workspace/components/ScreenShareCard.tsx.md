# `app/(dashboard)/workspace/components/ScreenShareCard.tsx`

> React component `ScreenShareCard`.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 100 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `ScreenShare` (lucide-react), `Maximize2` (lucide-react)

### Props

- **`ScreenShareCard`**: `peer: PeerState`, `screenTrack: MediaStreamTrack`, `onWatch: () => void`

**Hooks used:** `useEffect`×2, `useRef`, `useMemo`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `ScreenShareCard` | component | `memo( ({ peer, screenTrack, onWatch, }: { peer: PeerState; screenTrack: MediaStreamTrack;…` | 9 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `app/(dashboard)/workspace/types.ts` — `PeerState`
  - `app/(dashboard)/workspace/utils.ts` — `buildSingleTrackStream`
- **Packages:**
  - `react` — `memo`, `useMemo`, `useRef`, `useEffect`
  - `framer-motion` — `motion`
  - `lucide-react` — `ScreenShare`, `Maximize2`

## Used by

- `app/(dashboard)/workspace/components/FloorMeetingRoomCard.tsx`
