# `components/webinar/MicPickerDialog.tsx`

> "Which mic?" prompt, shown on join when the machine has more than one.

**Kind:** React component · **Lines:** 157 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
"Which mic?" prompt, shown on join when the machine has more than one.

Bat246/gotobigwin only — see the caller in WebinarRoomClient. Their hosts
present from setups with a headset, an interface and the built-in mic all
connected, and the browser's default is regularly the wrong one; they were
going live on the laptop mic without noticing. Everywhere else the default
is nearly always right and a modal on every join would be noise, so the
split-button dropdown in the control bar stays the way to change it.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Loader2`×2 (lucide-react), `Dialog` (components/ui/dialog.tsx), `DialogContent` (components/ui/dialog.tsx), `DialogHeader` (components/ui/dialog.tsx), `DialogTitle` (components/ui/dialog.tsx), `Mic` (lucide-react), `DialogDescription` (components/ui/dialog.tsx), `DialogFooter` (components/ui/dialog.tsx)

### Props

- **`MicPickerDialog`**: `open: boolean`, `onOpenChange: (open: boolean) => void`, `listDevices: () => Promise<{ audioinput: MediaDeviceInfo[] }>`, `onPickDevice: (deviceId: string) => Promise<void> | void`

**Hooks used:** `useState`×4, `useCallback`, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (MicPickerDialog)` | component | `MicPickerDialog({ open, onOpenChange, listDevices, onPickDevice, }: Props)` | 32 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/ui/dialog.tsx` — `Dialog`, `DialogContent`, `DialogDescription`, `DialogFooter`, `DialogHeader`, `DialogTitle`
  - `lib/webinar/mic-devices.ts` — `realAudioInputs`, `micLabel`
- **Packages:**
  - `react` — `useCallback`, `useEffect`, `useState`
  - `lucide-react` — `Mic`, `Loader2`

## Used by

- `app/webinar/[id]/WebinarRoomClient.tsx`
