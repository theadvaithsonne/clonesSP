# `components/dashboard/AudioCallOverlay.tsx`

> React component `AudioCallOverlay`.

**Kind:** React component · **Lines:** 96 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Button`×2 (components/ui/button.tsx), `User` (lucide-react), `MicOff` (lucide-react), `Mic` (lucide-react), `PhoneOff` (lucide-react)

**Hooks used:** `useWebRTC` (lib/webrtc-context.tsx), `useRef`, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (AudioCallOverlay)` | component | `AudioCallOverlay()` | 12 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/webrtc-context.tsx` — `useWebRTC`
  - `components/ui/button.tsx` — `Button`
  - `lib/utils.ts` — `cn`
- **Packages:**
  - `react` — `useEffect`, `useRef`
  - `react-dom` — `createPortal`
  - `lucide-react` — `Mic`, `MicOff`, `PhoneOff`, `User`

## Used by

- `app/(dashboard)/layout.tsx`
