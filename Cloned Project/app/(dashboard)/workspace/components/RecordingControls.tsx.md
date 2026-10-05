# `app/(dashboard)/workspace/components/RecordingControls.tsx`

> React component `RecordingControls`.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 172 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Button`×3 (components/ui/button.tsx), `GripHorizontal` (lucide-react), `Mic` (lucide-react), `MicOff` (lucide-react), `Video` (lucide-react), `VideoOff` (lucide-react), `Square` (lucide-react)

### Props

- **`RecordingControls`**: `isRecordingMicOn: boolean`, `isRecordingCameraOn: boolean`, `onMicToggle: () => void`, `onCameraToggle: () => void`, `onStopRecording: () => void`, `recordingDuration: number`

**Hooks used:** `useRef`×3, `useCallback`×3, `useState`×2, `useEffect`×2

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `RecordingControls` | component | `RecordingControls({ isRecordingMicOn, isRecordingCameraOn, onMicToggle, onCam…)` | 18 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/ui/button.tsx` — `Button`
  - `lib/utils.ts` — `cn`
- **Packages:**
  - `react` — `useRef`, `useState`, `useEffect`, `useCallback`
  - `framer-motion` — `motion`
  - `lucide-react` — `Mic`, `MicOff`, `Video`, `VideoOff`, `Square`, `GripHorizontal`

## Used by

- `app/(dashboard)/workspace/WorkspaceClient.tsx`
