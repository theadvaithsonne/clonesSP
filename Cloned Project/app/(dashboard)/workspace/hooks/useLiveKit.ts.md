# `app/(dashboard)/workspace/hooks/useLiveKit.ts`

> React hook `useLiveKit`.

**Kind:** React hook · **Lines:** 918 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

**Hooks used:** `useState`×18, `useRef`×10, `useCallback`×10, `useEffect`×4

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `RemoteUserTracks` | interface |  | 19 |
| `LiveKitChatMessage` | interface |  | 30 |
| `DailyChatMessage` | type |  | 39 |
| `useLiveKit` | hook | `useLiveKit()` | 63 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `POST /backend/livekit/recording/stop` (L797)
  - `POST /backend/livekit/recording/start` (L819)
- **Socket.IO events:**
  - emits: `workspace:move-to-space`, `livekit:screen-share-state`, `livekit:leave-call`
  - listens for: `livekit:init-call`, `livekit:join-call`, `livekit:leave-call`, `livekit:participants-update`, `livekit:call-answered-elsewhere`, `livekit:join-error`
- **Environment variables (`process.env`):** `NEXT_PUBLIC_API_URL`
- **Timers / queues:** `setInterval` at L130

## Dependencies

- **Internal:**
  - `lib/socket.ts` — `connectSocket`
- **Packages:**
  - `react` — `useState`, `useEffect`, `useRef`, `useCallback`
  - `livekit-client` — `Room`, `RoomEvent`, `Track`, `RemoteParticipant`, `RemoteTrackPublication`, `LocalParticipant`, …
  - `sonner` — `toast`

## Used by

- `lib/workspace-livekit-context.tsx`
