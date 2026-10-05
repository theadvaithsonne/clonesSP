# `components/ui/floating-recording-indicator.tsx`

> React component `FloatingRecordingIndicator`.

**Kind:** UI primitive (shadcn/Radix wrapper) · **Lines:** 167 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Button`×3 (components/ui/button.tsx), `AnimatePresence` (framer-motion), `GripHorizontal` (lucide-react), `Monitor` (lucide-react), `Play` (lucide-react), `Pause` (lucide-react), `Square` (lucide-react)

### Props

- **`FloatingRecordingIndicator`**: `onOpenChat?: (type: "dm" | "group" | "post", id: string) => void`

**Hooks used:** `useScreenRecording` (lib/screen-recording-context.tsx), `useDragControls` (framer-motion), `useRef`, `useState`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `FloatingRecordingIndicator` | component | `FloatingRecordingIndicator({ onOpenChat, }: FloatingRecordingIndicatorProps)` | 14 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/screen-recording-context.tsx` — `useScreenRecording`
  - `components/ui/button.tsx` — `Button`
  - `lib/utils.ts` — `cn`
- **Packages:**
  - `lucide-react` — `Square`, `Pause`, `Play`, `X`, `Monitor`, `GripHorizontal`
  - `framer-motion` — `motion`, `AnimatePresence`, `useDragControls`
  - `react` — `useRef`, `useState`

## Used by

- `app/(dashboard)/layout.tsx`
