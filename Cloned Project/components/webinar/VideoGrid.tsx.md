# `components/webinar/VideoGrid.tsx`

> React component `VideoGrid`.

**Kind:** React component · **Lines:** 861 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Tile`×4 (local), `RemoteAudio`×2 (local), `ConnectionBars` (local), `MicOff` (lucide-react), `ReactionOverlay` (local), `PinAdVideoSpotlight` (local)

**Hooks used:** `useWebinarStore`×8 (store/webinarStore.ts), `useEffect`×6, `useRef`×4, `useState`×3, `useAuthStore` (store/authStore.tsx)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (VideoGrid)` | component | `VideoGrid()` | 583 |

## Interfaces

- **Timers / queues:** `setTimeout` at L386, L450; `setInterval` at L449

## Dependencies

- **Internal:**
  - `store/webinarStore.ts` — `useWebinarStore (default)`
  - `store/authStore.tsx` — `useAuthStore`
- **Packages:**
  - `react` — `useEffect`, `useRef`, `useState`
  - `lucide-react` — `MicOff`

## Used by

- `app/webinar/[id]/WebinarRoomClient.tsx`
