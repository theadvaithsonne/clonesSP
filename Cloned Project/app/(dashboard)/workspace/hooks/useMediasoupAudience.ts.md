# `app/(dashboard)/workspace/hooks/useMediasoupAudience.ts`

> React hook `useMediasoupAudience`.

**Kind:** React hook · **Lines:** 316 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

**Hooks used:** `useState`×9, `useRef`×4, `useEffect`×4, `useCallback`×3

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `RemoteTrack` | interface |  | 13 |
| `UseMediasoupAudienceResult` | interface |  | 20 |
| `useMediasoupAudience` | hook | `useMediasoupAudience(): UseMediasoupAudienceResult` — Preview-audience hook. | 41 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `POST /backend/webinar/${webinarId}/livekit-token` (L212)
- **Socket.IO events:**
  - emits: `webinar:joinRoom`

## Dependencies

- **Internal:**
  - `lib/socket.ts` — `connectWebinarSocket`
  - `lib/auth.ts` — `getToken`
  - `lib/api.ts` — `API_URL`
- **Packages:**
  - `react` — `useState`, `useEffect`, `useRef`, `useCallback`
  - `livekit-client` — `Room`, `RoomEvent`, `Track`, `RemoteParticipant`

## Used by

- `app/(dashboard)/workspace/components/WorkshopPreviewSection.tsx`
- `components/webinar-live-preview/WebinarLivePreviewPopup.tsx`
