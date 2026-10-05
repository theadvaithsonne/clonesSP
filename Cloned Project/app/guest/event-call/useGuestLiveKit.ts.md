# `app/guest/event-call/useGuestLiveKit.ts`

> React hook `useGuestLiveKit`.

**Kind:** React hook · **Lines:** 584 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

**Hooks used:** `useState`×13, `useCallback`×10, `useRef`×4, `useEffect`×3

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `RemoteUserTracks` | interface |  | 17 |
| `useGuestLiveKit` | hook | `useGuestLiveKit(config: GuestLiveKitConfig \| null)` | 52 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:** none
- **Packages:**
  - `react` — `useState`, `useEffect`, `useRef`, `useCallback`
  - `livekit-client` — `Room`, `RoomEvent`, `Track`, `RemoteParticipant`, `RemoteTrackPublication`, `LocalParticipant`, …
  - `sonner` — `toast`

## Used by

- `app/guest/event-call/GuestVideoCall.tsx`
