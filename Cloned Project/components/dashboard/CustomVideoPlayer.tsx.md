# `components/dashboard/CustomVideoPlayer.tsx`

> React component `CustomVideoPlayer`.

**Kind:** React component · **Lines:** 560 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Loader2` (lucide-react), `RotateCcw` (lucide-react), `Pause` (lucide-react), `Play` (lucide-react), `RotateCw` (lucide-react), `VolumeX` (lucide-react), `Volume2` (lucide-react), `Minimize` (lucide-react), `Maximize` (lucide-react)

### Props

- **`CustomVideoPlayer`**: `src: string`, `poster?: string`, `autoPlay?: boolean`, `className?: string`, `onEnded?: () => void`, `id?: string`, `onTimeUpdate?: (seconds: number) => void`

**Hooks used:** `useState`×8, `useEffect`×5, `useRef`×3

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (CustomVideoPlayer)` | component | `CustomVideoPlayer({ src, poster, autoPlay = true, className, onEnded, id, onT…)` | 39 |

## Interfaces

- **Timers / queues:** `setInterval` at L165; `setTimeout` at L209
- **External hosts mentioned in the code:** `www.youtube.com`, `player.vimeo.com`

## Dependencies

- **Internal:**
  - `lib/utils.ts` — `cn`
- **Packages:**
  - `react` — `useRef`, `useState`, `useEffect`
  - `lucide-react` — `Play`, `Pause`, `Volume2`, `VolumeX`, `Maximize`, `Minimize`, …

## Used by

- `app/(dashboard)/thoughts/components/blocks/VideoBlock.tsx`
- `components/dashboard/CoursesPage.tsx`
- `components/dashboard/FeedComponents.tsx`
- `components/dashboard/RightPanel.tsx`
- `components/feed/CreatePostModal.tsx`
- `components/feed/InlinePostComposer.tsx`
