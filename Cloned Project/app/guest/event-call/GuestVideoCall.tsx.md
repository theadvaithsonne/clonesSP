# `app/guest/event-call/GuestVideoCall.tsx`

> React component `GuestVideoCall`.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 592 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `DailyVideoPlayer`×5 (app/(dashboard)/workspace/components/DailyVideoPlayer.tsx), `Button`×3 (components/ui/button.tsx), `ScreenShare`×2 (lucide-react), `MicOff` (lucide-react), `Mic` (lucide-react), `VideoOff` (lucide-react), `Video` (lucide-react), `PhoneOff` (lucide-react)

### Props

- **`GuestVideoCall`**: `displayName: string`, `eventTitle: string`

**Hooks used:** `useEffect`×6, `useState`×4, `useRouter` (next/navigation), `useRef`, `useGuestLiveKit` (app/guest/event-call/useGuestLiveKit.ts), `useCallback`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (GuestVideoCall)` | component | `GuestVideoCall({ displayName, eventTitle }: GuestVideoCallProps)` | 17 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/public/events/participants-public?code=${joinCode}` (L95)
- **Socket.IO events:**
  - emits: `guest:join-event-call`
  - listens for: `livekit:screen-share-state`, `livekit:init-call`, `livekit:participants-update`, `connect`, `reconnect`
- **Environment variables (`process.env`):** `NEXT_PUBLIC_API_URL`
- **Browser storage / cookies:** `guest_join_code` (sessionStorage: get), `guest_livekit_server_url` (sessionStorage: get/remove), `guest_livekit_token` (sessionStorage: get/remove), `guest_livekit_room_name` (sessionStorage: get/remove), `guest_jwt` (sessionStorage: get/remove), `guest_event_id` (sessionStorage: remove), `guest_display_name` (sessionStorage: remove)
- **Timers / queues:** `setInterval` at L280

## Dependencies

- **Internal:**
  - `components/ui/button.tsx` — `Button`
  - `app/(dashboard)/workspace/components/DailyVideoPlayer.tsx` — `DailyVideoPlayer (default)`
  - `app/guest/event-call/useGuestLiveKit.ts` — `useGuestLiveKit`
  - `lib/socket.ts` — `connectGuestSocket`, `disconnectGuestSocket`
- **Packages:**
  - `react` — `useState`, `useEffect`, `useCallback`, `useRef`
  - `next` — `useRouter`
  - `lucide-react` — `Mic`, `MicOff`, `Video`, `VideoOff`, `PhoneOff`, `ScreenShare`
  - `sonner` — `toast`
  - `framer-motion` — `motion`

## Used by

- `app/guest/event-call/page.tsx`
- `app/guest/event-join/page.tsx`
