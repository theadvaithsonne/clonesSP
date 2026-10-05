# `app/(dashboard)/workspace/components/OccupantAvatarSmall.tsx`

> React component `OccupantAvatarSmall`.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 136 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Avatar` (components/ui/avatar.tsx), `AvatarFallback` (components/ui/avatar.tsx), `ScreenShare` (lucide-react)

### Props

- **`OccupantAvatarSmall`**: `peer: PeerState`, `isLocal: boolean`, `initials: string`, `isVideoOn?: boolean`, `isScreenSharing?: boolean`, `onWatchScreenShare: () => void`

**Hooks used:** `useMemo`×2, `useRef`, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `OccupantAvatarSmall` | component | `memo( ({ peer, isLocal, initials, isVideoOn, isScreenSharing, onWatchScreenShare, }: { pe…` | 15 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `app/(dashboard)/workspace/types.ts` — `PeerState`
  - `app/(dashboard)/workspace/utils.ts` — `getPreferredScreenTrack`, `getActiveCameraTrack`, `buildSingleTrackStream`
  - `lib/utils.ts` — `cn`
  - `components/ui/avatar.tsx` — `Avatar`, `AvatarFallback`
- **Packages:**
  - `react` — `memo`, `useMemo`, `useRef`, `useEffect`
  - `lucide-react` — `ScreenShare`
  - `framer-motion` — `motion`

## Used by

- `app/(dashboard)/workspace/components/FloorMeetingRoomCard.tsx`
- `app/(dashboard)/workspace/components/UserSpaceCard.tsx`
