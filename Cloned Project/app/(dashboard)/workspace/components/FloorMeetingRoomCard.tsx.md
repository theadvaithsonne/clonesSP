# `app/(dashboard)/workspace/components/FloorMeetingRoomCard.tsx`

> React component `FloorMeetingRoomCard`.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 161 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `OccupantAvatarSmall` (app/(dashboard)/workspace/components/OccupantAvatarSmall.tsx), `Loader2` (lucide-react)

### Props

- **`FloorMeetingRoomCard`**: `floor: Floor`, `occupants: PeerState[]`, `meId: string`, `isJoining?: boolean`, `onJoin: () => void`, `onWatchScreenShare: (peer: PeerState) => void`

**Hooks used:** `useMemo`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `FloorMeetingRoomCard` | component | `memo( ({ floor, occupants, meId, isJoining, onJoin, onWatchScreenShare, }: { floor: Floor…` | 16 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `app/(dashboard)/workspace/types.ts` — `PeerState`, `Floor`
  - `app/(dashboard)/workspace/utils.ts` — `getPreferredScreenTrack`, `getActiveCameraTrack`, `buildSingleTrackStream`
  - `lib/utils.ts` — `cn`
  - `app/(dashboard)/workspace/components/ScreenShareCard.tsx` — `ScreenShareCard`
  - `app/(dashboard)/workspace/components/OccupantAvatarSmall.tsx` — `OccupantAvatarSmall`
- **Packages:**
  - `react` — `memo`, `useMemo`
  - `framer-motion` — `motion`
  - `lucide-react` — `Loader2`

## Used by

No other file imports this one and it has no automatic entry point — it appears unused (or is loaded dynamically by a path the import graph cannot see).
