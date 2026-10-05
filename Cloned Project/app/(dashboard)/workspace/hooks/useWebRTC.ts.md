# `app/(dashboard)/workspace/hooks/useWebRTC.ts`

> React hook `useWebRTC`.

**Kind:** React hook · **Lines:** 467

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

**Hooks used:** `useRef`×8, `useCallback`×7, `useState`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `useWebRTC` | hook | `useWebRTC(me: string, localStream: MediaStream \| null, cameraTrackRef: React.MutableRefObject<MediaStreamTrack \| n…)` | 24 |

## Interfaces

- **Socket.IO events:**
  - emits: `workspace:signal`, `renegotiation-needed`
- **Timers / queues:** `setTimeout` at L137, L197, L382, L409, L421

## Dependencies

- **Internal:**
  - `lib/socket.ts` — `connectSocket`
  - `app/(dashboard)/workspace/types.ts` — `PeerState`
  - `app/(dashboard)/workspace/utils.ts` — `isScreenTrack`
- **Packages:**
  - `react` — `useCallback`, `useRef`, `useState`

## Used by

- `app/(dashboard)/workspace/WorkspaceClient.tsx`
