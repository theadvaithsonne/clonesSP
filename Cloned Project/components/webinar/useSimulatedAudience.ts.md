# `components/webinar/useSimulatedAudience.ts`

> Drips the host's scripted audience into the live chat.

**Kind:** React component · **Lines:** 108 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
Drips the host's scripted audience into the live chat.

Purely additive to the real room: it only ever calls `addMessage`, the same
store action the socket path uses, so a webinar with no simulated audience
behaves exactly as before and nothing here touches peers, mediasoup or the
socket.

The server decides which lines are due (it holds the session's real start
time and filters by it) rather than sending the whole script — otherwise
every "spontaneous" message would be readable in devtools before it appears.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

**Hooks used:** `useRef`×2, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `useSimulatedAudience` | hook | `useSimulatedAudience(webinarId: string \| undefined, active: boolean)` | 28 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/public/webinar/${webinarId}/simulated-audience` (L42)
- **Environment variables (`process.env`):** `NEXT_PUBLIC_API_URL`
- **Timers / queues:** `setInterval` at L99

## Dependencies

- **Internal:**
  - `store/webinarStore.ts` — `useWebinarStore (default)`
- **Packages:**
  - `react` — `useEffect`, `useRef`

## Used by

- `app/webinar/[id]/WebinarRoomClient.tsx`
