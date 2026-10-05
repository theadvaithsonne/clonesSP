# `components/community-stream/CommunityStreamOverlay.tsx`

> React component `CommunityStreamOverlay`.

**Kind:** React component · **Lines:** 638 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Button`×4 (components/ui/button.tsx), `MicOff`×3 (lucide-react), `VideoOff`×3 (lucide-react), `Video`×3 (lucide-react), `Users` (lucide-react), `X` (lucide-react), `OfficeFloorPlan` (local), `RemoteVideoAvatar` (local), `Mic` (lucide-react), `PhoneOff` (lucide-react)

### Props

- **`CommunityStreamOverlay`**: `isOpen: boolean`, `channelTitle: string`, `meId: string`, `onClose: () => void`

**Hooks used:** `useCallback`×4, `useRef`×2, `useEffect`×2, `useState`×2, `useCommunityStreamLiveKit` (components/community-stream/useCommunityStreamLiveKit.ts), `useAvatarPositions` (components/community-stream/useAvatarPositions.ts), `useProximityAudio` (components/community-stream/useProximityAudio.ts)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `CommunityStreamOverlay` | component | `memo( ({ isOpen, channelTitle, meId, onClose, }: CommunityStreamOverlayProps) => { // Use…` | 249 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/ui/button.tsx` — `Button`
  - `lib/utils.ts` — `cn`
  - `components/community-stream/useCommunityStreamLiveKit.ts` — `useCommunityStreamLiveKit`, `RemoteUserTracks`
  - `components/community-stream/useAvatarPositions.ts` — `useAvatarPositions`, `WORLD_WIDTH`, `WORLD_HEIGHT`, `RADIUS_CIRCLE_SIZE`
  - `components/community-stream/useProximityAudio.ts` — `useProximityAudio`
- **Packages:**
  - `react` — `memo`, `useState`, `useCallback`, `useRef`, `useEffect`
  - `framer-motion` — `motion`
  - `lucide-react` — `X`, `PhoneOff`, `Mic`, `MicOff`, `Video`, `VideoOff`, …

## Used by

- `components/community-stream/index.ts`
