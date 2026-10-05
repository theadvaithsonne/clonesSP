# `components/dashboard/ConferenceMemoPanel.tsx`

> React component `ConferenceMemoPanel`.

**Kind:** React component · **Lines:** 262 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Mic`×3 (lucide-react), `X` (lucide-react), `Square` (lucide-react), `Pause` (lucide-react), `Play` (lucide-react), `Trash2` (lucide-react), `Upload` (lucide-react), `CheckCircle2` (lucide-react)

### Props

- **`ConferenceMemoPanel`**: `room: Room | null`, `spaceId: string`, `meetTitle: string`, `nameByIdentity: Map<string, string>`, `onClose: () => void`, `onRecordingChange?: (active: boolean) => void`

**Hooks used:** `useState`×3, `useEffect`×2, `useMeetMemoRecorder` (lib/hooks/use-meet-memo-recorder.ts), `useVoiceMemos` (lib/hooks/use-voice-memos.ts)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (ConferenceMemoPanel)` | component | `ConferenceMemoPanel({ room, spaceId, meetTitle, nameByIdentity, onClose, onReco…)` — In-conference voice-memo panel. | 37 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/hooks/use-meet-memo-recorder.ts` — `useMeetMemoRecorder`
  - `lib/hooks/use-voice-memos.ts` — `useVoiceMemos`
  - `hooks/use-voice-recorder.ts` — `formatElapsed`
- **Packages:**
  - `react` — `useEffect`, `useState`
  - `livekit-client` — `Room`
  - `lucide-react` — `CheckCircle2`, `Mic`, `Pause`, `Play`, `Square`, `Trash2`, …
  - `sonner` — `toast`

## Used by

- `components/dashboard/ConferenceRoomPage.tsx`
