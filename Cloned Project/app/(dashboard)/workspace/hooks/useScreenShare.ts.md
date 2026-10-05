# `app/(dashboard)/workspace/hooks/useScreenShare.ts`

> React hook `useScreenShare`.

**Kind:** React hook · **Lines:** 229

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

**Hooks used:** `useCallback`×4, `useState`×3, `useRef`×3

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `useScreenShare` | hook | `useScreenShare(localStream: MediaStream \| null, me: string, updatePeerState: (peerId: string, data: Partial<PeerState>)…, getVideoSender: ( peerId: string, pc: RTCPeerConnection ) =…, getSe…` | 6 |

## Interfaces

- **Socket.IO events:**
  - emits: `workspace:screen-share-state`

## Dependencies

- **Internal:**
  - `app/(dashboard)/workspace/types.ts` — `PeerState`
  - `app/(dashboard)/workspace/utils.ts` — `isScreenTrack`
  - `lib/socket.ts` — `connectSocket`
- **Packages:**
  - `react` — `useState`, `useRef`, `useCallback`

## Used by

- `app/(dashboard)/workspace/WorkspaceClient.tsx`
