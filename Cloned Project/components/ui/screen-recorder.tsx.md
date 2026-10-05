# `components/ui/screen-recorder.tsx`

> React component `ScreenRecorder`.

**Kind:** UI primitive (shadcn/Radix wrapper) · **Lines:** 546 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Button`×7 (components/ui/button.tsx), `Monitor`×2 (lucide-react), `Play`×2 (lucide-react), `Trash2` (lucide-react), `Send` (lucide-react), `Pause` (lucide-react), `Square` (lucide-react), `X` (lucide-react)

### Props

- **`ScreenRecorder`**: `onRecordingComplete: (file: File) => void`, `onSend?: (file: File) => void`, `className?: string`, `target?: RecordingTarget`

**Hooks used:** `useRef`×7, `useState`×6, `useEffect`×2, `useScreenRecording` (lib/screen-recording-context.tsx), `useCallback`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `ScreenRecorder` | component | `ScreenRecorder({ onRecordingComplete, onSend, className, target, }: Screen…)` | 17 |

## Interfaces

- **Timers / queues:** `setInterval` at L199, L228

## Dependencies

- **Internal:**
  - `components/ui/button.tsx` — `Button`
  - `lib/utils.ts` — `cn`
  - `lib/screen-recording-context.tsx` — `useScreenRecording`, `RecordingTarget`
- **Packages:**
  - `react` — `useState`, `useRef`, `useEffect`, `useCallback`
  - `lucide-react` — `Monitor`, `Square`, `Trash2`, `Send`, `Pause`, `Play`, …

## Used by

- `components/dashboard/DMPage.tsx`
- `components/dashboard/GlobalDMPage.tsx`
- `components/dashboard/GroupChatPage.tsx`
- `components/feed/CreatePostModal.tsx`
- `components/feed/InlinePostComposer.tsx`
