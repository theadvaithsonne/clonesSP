# `components/ui/voice-recorder.tsx`

> React component `VoiceRecorder`.

**Kind:** UI primitive (shadcn/Radix wrapper) · **Lines:** 356 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Button`×7 (components/ui/button.tsx), `Play`×2 (lucide-react), `Pause`×2 (lucide-react), `Trash2`×2 (lucide-react), `Mic` (lucide-react), `Square` (lucide-react), `Send` (lucide-react)

### Props

- **`VoiceRecorder`**: `onRecordingComplete: (file: File) => void`, `onSend?: (file: File) => void`, `className?: string`

**Hooks used:** `useState`×6, `useRef`×5, `useEffect`×2

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `VoiceRecorder` | component | `VoiceRecorder({ onRecordingComplete, onSend, className, }: VoiceRecorderP…)` | 14 |

## Interfaces

- **Timers / queues:** `setInterval` at L103, L118

## Dependencies

- **Internal:**
  - `components/ui/button.tsx` — `Button`
  - `lib/utils.ts` — `cn`
- **Packages:**
  - `react` — `useState`, `useRef`, `useEffect`
  - `lucide-react` — `Mic`, `Square`, `Trash2`, `Send`, `Pause`, `Play`

## Used by

- `components/dashboard/DMPage.tsx`
- `components/dashboard/GlobalDMPage.tsx`
- `components/dashboard/GroupChatPage.tsx`
- `components/garage-admin/SupportChatsConsole.tsx`
