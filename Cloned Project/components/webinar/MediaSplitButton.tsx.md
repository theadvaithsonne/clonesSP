# `components/webinar/MediaSplitButton.tsx`

> React component `MediaSplitButton`.

**Kind:** React component · **Lines:** 218 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `ChevronUp` (lucide-react), `Loader2` (lucide-react), `Check` (lucide-react)

### Props

- **`MediaSplitButton`**: `kind: "audio" | "video"`, `enabled: boolean`, `onToggle: () => void`, `onIcon: React.ReactNode`, `offIcon: React.ReactNode`, `onLabel: string`, `offLabel: string`, `listDevices: () => Promise<{ videoinput: MediaDeviceInfo[]; audioinpu…`, `onPickDevice: (id: string) => Promise<void> | void`, `open: boolean`, `onOpenChange: (open: boolean) => void`, `emphasizeSplit?: boolean`

**Hooks used:** `useState`×4, `useCallback`, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (MediaSplitButton)` | component | `MediaSplitButton({ kind, enabled, onToggle, onIcon, offIcon, onLabel, offLab…)` — Zoom-style split control: the main face is the existing mute/unmute (or cam on/off) button; the trailing chevron pops a device list so a user with multiple mics/cams can switch without leaving the bar. | 54 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/webinar/glass.ts` — `GLASS_MENU`, `GLASS_CAPTION`, `GLASS_SPLIT_IDLE`, `GLASS_SPLIT_MUTED`, `GLASS_SPLIT_SHELL`
- **Packages:**
  - `react` — `useCallback`, `useEffect`, `useState`
  - `lucide-react` — `ChevronUp`, `Check`, `Loader2`

## Used by

- `components/webinar/ControlBar.tsx`
