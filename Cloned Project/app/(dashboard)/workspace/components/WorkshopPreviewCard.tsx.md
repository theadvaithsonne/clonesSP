# `app/(dashboard)/workspace/components/WorkshopPreviewCard.tsx`

> React component `WorkshopPreviewCard`.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 206 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `PreviewVideoPlayer` (local), `Maximize2` (lucide-react), `Users` (lucide-react), `VolumeX` (lucide-react), `Volume2` (lucide-react)

### Props

- **`WorkshopPreviewCard`**: `workshop: LiveWorkshopData`, `screenShareTrack: MediaStreamTrack | null`, `cameraTrack: MediaStreamTrack | null`, `isMuted: boolean`, `onToggleMute: () => void`, `onExpand: () => void`, `isConnecting: boolean`

**Hooks used:** `useRef`, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `WorkshopPreviewCard` | component | `memo( ({ workshop, screenShareTrack, cameraTrack, isMuted, onToggleMute, onExpand, isConn…` | 66 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/utils.ts` — `cn`
  - `app/(dashboard)/workspace/hooks/useWorkshopPreview.ts` — `LiveWorkshopData`
- **Packages:**
  - `react` — `memo`, `useEffect`, `useRef`
  - `framer-motion` — `motion`
  - `lucide-react` — `Volume2`, `VolumeX`, `Users`, `Maximize2`

## Used by

- `app/(dashboard)/workspace/components/WorkshopPreviewSection.tsx`
