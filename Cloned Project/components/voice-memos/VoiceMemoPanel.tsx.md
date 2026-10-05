# `components/voice-memos/VoiceMemoPanel.tsx`

> Voice memos panel — opened from the webinar ControlBar.

**Kind:** React component · **Lines:** 292 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
Voice memos panel — opened from the webinar ControlBar. Lets the
presenter (or any participant) capture a personal voice memo, ship
it to NetworkChain's voice-agent for transcription + summary, and
browse their full memo history (across all webinars / meetings).

Audio source: the local user's mic only — NOT the mixed webinar
audio. Mixing all participants requires server-side egress, which
is out of scope for this lightweight memo flow.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `X` (lucide-react), `Mic` (lucide-react), `Square` (lucide-react), `Pause` (lucide-react), `Play` (lucide-react), `Loader2` (lucide-react), `VoiceMemoStatusBadge` (components/voice-memos/VoiceMemoStatusBadge.tsx), `Pencil` (lucide-react), `RefreshCw` (lucide-react), `Trash2` (lucide-react)

### Props

- **`VoiceMemoPanel`**: `webinarId: string`, `webinarTitle?: string`, `participants?: { identity: string; name?: string }[]`, `onClose: () => void`

**Hooks used:** `useState`×4, `useVoiceRecorder` (hooks/use-voice-recorder.ts), `useVoiceMemos` (lib/hooks/use-voice-memos.ts), `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (VoiceMemoPanel)` | component | `VoiceMemoPanel({ webinarId, webinarTitle, participants, onClose, }: Props)` | 32 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `hooks/use-voice-recorder.ts` — `formatElapsed`, `useVoiceRecorder`
  - `lib/hooks/use-voice-memos.ts` — `useVoiceMemos`
  - `lib/api/voice-memos.ts` — `VoiceMemo`, `(types only)`
  - `components/voice-memos/VoiceMemoStatusBadge.tsx` — `VoiceMemoStatusBadge (default)`
- **Packages:**
  - `react` — `useEffect`, `useRef`, `useState`
  - `sonner` — `toast`
  - `lucide-react` — `Mic`, `Square`, `Pause`, `Play`, `Trash2`, `RefreshCw`, …

## Used by

- `components/webinar/ControlBar.tsx`
