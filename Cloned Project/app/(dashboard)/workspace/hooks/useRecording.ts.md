# `app/(dashboard)/workspace/hooks/useRecording.ts`

> React hook `useRecording`.

**Kind:** React hook · **Lines:** 1044

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

**Hooks used:** `useRef`×20, `useCallback`×10, `useState`×6, `useEffect`×3

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `useRecording` | hook | `useRecording(me: string, mySpaceId: string, localStream: MediaStream \| null, peers: Map<string, PeerState>, updatePeerState: UpdatePeerState): UseRecordingReturn` | 159 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `POST /backend/cabinet/files/upload?organizationId=${orgId}` (L668)
  - `POST /backend/ask-cabinet` (L743)
- **Socket.IO events:**
  - emits: `workspace:recording-state`
- **Browser storage / cookies:** `garage_org_id` (localStorage: get), `ask-cabinet-items` (localStorage: get/set)
- **Timers / queues:** `setInterval` at L635, L917

## Dependencies

- **Internal:**
  - `lib/socket.ts` — `connectSocket`
  - `app/(dashboard)/workspace/types.ts` — `PeerState`
  - `lib/api.ts` — `api`
  - `lib/auth.ts` — `getToken`
  - `lib/askCabinetUtils.ts` — `generateAskCabinetPrompt`
- **Packages:**
  - `react` — `useCallback`, `useRef`, `useState`, `useEffect`
  - `sonner` — `toast`

## Used by

- `app/(dashboard)/workspace/WorkspaceClient.tsx`
