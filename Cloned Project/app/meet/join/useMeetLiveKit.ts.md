# `app/meet/join/useMeetLiveKit.ts`

> React hook `useMeetLiveKit`.

**Kind:** React hook · **Lines:** 885 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

**Hooks used:** `useState`×25, `useCallback`×18, `useRef`×7, `useEffect`×5

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `RemoteUserTracks` | interface |  | 19 |
| `useMeetLiveKit` | hook | `useMeetLiveKit(config: MeetLiveKitConfig \| null, isHost: boolean = false)` | 53 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `POST /backend/livekit/recording/stop` (L751)
  - `POST /backend/livekit/recording/start` (L765)
- **Environment variables (`process.env`):** `NEXT_PUBLIC_API_URL`
- **Timers / queues:** `setTimeout` at L541

## Dependencies

- **Internal:** none
- **Packages:**
  - `react` — `useState`, `useEffect`, `useRef`, `useCallback`
  - `livekit-client` — `Room`, `RoomEvent`, `Track`, `RemoteParticipant`, `RemoteTrackPublication`, `LocalParticipant`, …
  - `sonner` — `toast`

## Used by

- `lib/meeting-context.tsx`
