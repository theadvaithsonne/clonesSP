# `app/(dashboard)/workspace/components/OccupantAvatar.tsx`

> React component `OccupantAvatar`.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 84 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `ScreenShare` (lucide-react), `Avatar` (components/ui/avatar.tsx), `AvatarFallback` (components/ui/avatar.tsx)

### Props

- **`OccupantAvatar`**: `peer: PeerState`, `isLocal: boolean`

**Hooks used:** `useMemo`×2, `useRef`, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `OccupantAvatar` | component | `memo( ({ peer, isLocal }: { peer: PeerState; isLocal: boolean }) => { const videoRef = us…` | 14 |

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

## Used by

No other file imports this one and it has no automatic entry point — it appears unused (or is loaded dynamically by a path the import graph cannot see).
