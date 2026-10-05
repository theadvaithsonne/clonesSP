# `components/webinar/SpeakerButton.tsx`

> React component `SpeakerButton`.

**Kind:** React component · **Lines:** 234 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Loader2`×2 (lucide-react), `VolumeX` (lucide-react), `Volume2` (lucide-react), `ChevronUp` (lucide-react), `Check` (lucide-react)

### Props

- **`SpeakerButton`**: `listDevices: () => Promise<{ videoinput: MediaDeviceInfo[]; audioinpu…`, `onPickOutputDevice: (id: string) => Promise<void> | void`, `open: boolean`, `onOpenChange: (open: boolean) => void`

**Hooks used:** `useState`×6, `useWebinarStore`×2 (store/webinarStore.ts), `useCallback`×2, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (SpeakerButton)` | component | `SpeakerButton({ listDevices, onPickOutputDevice, open, onOpenChange, }: P…)` — Speaker split-button for the control bar, shown to everyone (presenters and attendees). | 42 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `store/webinarStore.ts` — `useWebinarStore (default)`
  - `components/webinar/glass.ts` — `GLASS_MENU`, `GLASS_CAPTION`, `GLASS_SPLIT_IDLE`, `GLASS_SPLIT_MUTED`, `GLASS_SPLIT_SHELL`
- **Packages:**
  - `react` — `useCallback`, `useEffect`, `useState`
  - `lucide-react` — `Volume2`, `VolumeX`, `Check`, `Loader2`, `ChevronUp`

## Used by

- `components/webinar/ControlBar.tsx`
