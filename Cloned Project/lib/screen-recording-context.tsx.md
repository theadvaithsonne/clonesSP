# `lib/screen-recording-context.tsx`

> React component `ScreenRecordingProvider`.

**Kind:** frontend library · **Lines:** 439 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `ScreenRecordingContext` (local)

### Props

- **`ScreenRecordingProvider`**: `children: React.ReactNode`

**Hooks used:** `useCallback`×9, `useRef`×6, `useEffect`×2, `useState`, `useContext`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `RecordingTarget` | type |  | 13 |
| `RecordingState` | type |  | 20 |
| `ScreenRecordingProvider` | component | `ScreenRecordingProvider({ children }: { children: React.ReactNode })` | 51 |
| `useScreenRecording` | hook | `useScreenRecording()` | 432 |

## Interfaces

- **Browser storage / cookies:** `pendingPostScreenRecording` (localStorage: set/remove)
- **Timers / queues:** `setInterval` at L286, L332

## Dependencies

- **Internal:** none
- **Packages:**
  - `react` — `createContext`, `useContext`, `useState`, `useRef`, `useCallback`, `useEffect`

## Used by

- `app/(dashboard)/layout.tsx`
- `components/feed/InlinePostComposer.tsx`
- `components/ui/floating-recording-indicator.tsx`
- `components/ui/screen-recorder.tsx`
