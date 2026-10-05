# `components/dashboard/drops/DropVideoPlayer.tsx`

> React component `DropVideoPlayer`.

**Kind:** React component · **Lines:** 345 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Loader2` (lucide-react)

### Props

- **`DropVideoPlayer`**: `streamUrl: string`, `videoUrl?: string`, `sourceType: "upload" | "link"`, `thumbnailUrl?: string`, `isActive: boolean`, `isNext: boolean`, `onViewCounted?: () => void`

**Hooks used:** `useEffect`×9, `useRef`×6, `useState`×6, `useCallback`×3

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (DropVideoPlayer)` | component | `DropVideoPlayer({ streamUrl, videoUrl, sourceType, thumbnailUrl, isActive, …)` | 35 |

## Interfaces

- **Timers / queues:** `setTimeout` at L120, L168, L215, L223; `setInterval` at L180
- **External hosts mentioned in the code:** `www.youtube.com`, `player.vimeo.com`

## Dependencies

- **Internal:** none
- **Packages:**
  - `react` — `useRef`, `useEffect`, `useState`, `useCallback`
  - `lucide-react` — `Loader2`

## Used by

- `components/dashboard/DropsPage.tsx`
- `components/dashboard/RightPanel.tsx`
- `components/dashboard/drops/AllDropsTab.tsx`
- `components/dashboard/drops/MyUploadsTab.tsx`
