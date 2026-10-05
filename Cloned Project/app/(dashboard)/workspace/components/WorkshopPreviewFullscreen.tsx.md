# `app/(dashboard)/workspace/components/WorkshopPreviewFullscreen.tsx`

> React component `WorkshopPreviewFullscreen`.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 252 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `FullscreenVideoPlayer`×3 (local), `X` (lucide-react), `Users` (lucide-react), `VolumeX` (lucide-react), `Volume2` (lucide-react), `Minimize2` (lucide-react)

### Props

- **`WorkshopPreviewFullscreen`**: `workshop: LiveWorkshopData`, `screenShareTrack: MediaStreamTrack | null`, `cameraTrack: MediaStreamTrack | null`, `isMuted: boolean`, `onToggleMute: () => void`, `onClose: () => void`

**Hooks used:** `useEffect`×2, `useRef`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `WorkshopPreviewFullscreen` | component | `memo( ({ workshop, screenShareTrack, cameraTrack, isMuted, onToggleMute, onClose, }: Work…` | 77 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/utils.ts` — `cn`
  - `app/(dashboard)/workspace/hooks/useWorkshopPreview.ts` — `LiveWorkshopData`
- **Packages:**
  - `react` — `memo`, `useEffect`, `useRef`
  - `framer-motion` — `motion`
  - `lucide-react` — `X`, `Volume2`, `VolumeX`, `Users`, `Minimize2`

## Used by

- `app/(dashboard)/workspace/components/WorkshopPreviewSection.tsx`
