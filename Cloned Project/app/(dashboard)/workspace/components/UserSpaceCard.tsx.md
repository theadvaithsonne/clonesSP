# `app/(dashboard)/workspace/components/UserSpaceCard.tsx`

> React component `UserSpaceCard`.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 472 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Button`×5 (components/ui/button.tsx), `LastSeen` (components/shared/LastSeen.tsx), `Avatar` (components/ui/avatar.tsx), `AvatarFallback` (components/ui/avatar.tsx), `MessageSquare` (lucide-react), `User` (lucide-react), `MicOff` (lucide-react), `Mic` (lucide-react), `PhoneOff` (lucide-react), `OccupantAvatarSmall` (app/(dashboard)/workspace/components/OccupantAvatarSmall.tsx)

### Props

- **`UserSpaceCard`**: `owner: PeerState & { isBusyInPrivateMeeting?: boolean; isBusyInPublic…`, `occupants: PeerState[]`, `meId: string`, `mySpaceId: string`, `onKnock: (peer: PeerState) => void`, `onCancelKnock?: (peer: PeerState) => void`, `knockingId: string | null`, `onWatchScreenShare: (peer: PeerState) => void`, `onBook: () => void`, `isInKnockCall?: boolean`, `isMicMuted?: boolean`, `onToggleMic?: () => void`, `onEndCall?: () => void`

**Hooks used:** `useMemo`×2, `useRef`, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `UserSpaceCard` | component | `memo( ({ owner, occupants, meId, mySpaceId, onKnock, onCancelKnock, knockingId, onWatchSc…` | 20 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `app/(dashboard)/workspace/types.ts` — `PeerState`
  - `app/(dashboard)/workspace/utils.ts` — `getPreferredScreenTrack`, `isLiveCameraTrack`, `buildSingleTrackStream`, `getActiveCameraTrack`
  - `lib/utils.ts` — `cn`
  - `app/(dashboard)/workspace/components/OccupantAvatarSmall.tsx` — `OccupantAvatarSmall`
  - `components/ui/avatar.tsx` — `Avatar`, `AvatarFallback`
  - `components/ui/button.tsx` — `Button`
  - `components/shared/LastSeen.tsx` — `LastSeen`
- **Packages:**
  - `react` — `memo`, `useMemo`, `useRef`, `useEffect`, `useState`
  - `framer-motion` — `motion`
  - `lucide-react` — `DoorClosed`, `MessageSquare`, `Mic`, `MicOff`, `PhoneOff`, `User`

## Used by

- `app/(dashboard)/workspace/WorkspaceClient.tsx`
