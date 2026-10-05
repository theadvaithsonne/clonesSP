# `components/webinar/WebinarPipContent.tsx`

> React component `WebinarPipContent`.

**Kind:** React component · **Lines:** 463 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `PipVideoTile`×3 (local), `MicOff`×2 (lucide-react), `Monitor` (lucide-react), `LayoutGrid` (lucide-react), `Mic` (lucide-react), `Video` (lucide-react), `VideoOff` (lucide-react), `PhoneOff` (lucide-react)

### Props

- **`WebinarPipContent`**: `onToggleMic: () => void`, `onToggleCam: () => void`, `onLeave: () => void`

**Hooks used:** `useWebinarStore`×10 (store/webinarStore.ts), `useState`×3, `useEffect`×3, `useRef`, `useAuthStore` (store/authStore.tsx)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (WebinarPipContent)` | component | `WebinarPipContent({ onToggleMic, onToggleCam, onLeave, }: Props)` | 199 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `store/webinarStore.ts` — `useWebinarStore (default)`
  - `store/authStore.tsx` — `useAuthStore`
- **Packages:**
  - `react` — `useEffect`, `useRef`, `useState`
  - `lucide-react` — `Mic`, `MicOff`, `Video`, `VideoOff`, `PhoneOff`, `LayoutGrid`, …

## Used by

- `app/webinar/[id]/WebinarRoomClient.tsx`
