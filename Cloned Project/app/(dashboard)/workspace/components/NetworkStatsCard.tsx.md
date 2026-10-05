# `app/(dashboard)/workspace/components/NetworkStatsCard.tsx`

> React component `NetworkStatsCard`.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 510 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Particles` (local), `ArcRing` (local), `Building2` (lucide-react), `AnimatedNumber` (local), `CardLivePreview` (local), `ExternalLink` (lucide-react), `Radio` (lucide-react), `X` (lucide-react), `Users` (lucide-react), `VolumeX` (lucide-react), `Volume2` (lucide-react), `NetworkGraph` (local)

### Props

- **`NetworkStatsCard`**: `orgId: string`

**Hooks used:** `useState`×8, `useEffect`×6, `useRef`×4, `useWebinarLivePreview` (hooks/useWebinarLivePreview.ts)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `NetworkStatsCard` | component | `memo(({ orgId }: { orgId: string }) => { const [stats, setStats] = useState<NetworkStats …` | 284 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `POST /backend/workshop-preview/audience-token` (L218)
  - `GET /backend/team/network-stats?orgId=${orgId}` (L317)
  - `GET /backend/auth/me` (L320)
  - `GET /backend/org/${orgId}/branding` (L325)
- **Socket.IO events:**
  - emits: `webinar:previewWatch`, `webinar:previewLeave`
- **Timers / queues:** `setTimeout` at L304

## Dependencies

- **Internal:**
  - `lib/api.ts` — `api`, `API_URL`
  - `lib/socket.ts` — `getSocket`
  - `hooks/useWebinarLivePreview.ts` — `useWebinarLivePreview`
- **Packages:**
  - `react` — `memo`, `useEffect`, `useState`, `useRef`, `useCallback`
  - `framer-motion` — `motion`
  - `lucide-react` — `Building2`, `Radio`, `ExternalLink`, `X`, `VolumeX`, `Volume2`, …
  - `livekit-client` — `Room`, `RoomEvent`, `Track`

## Used by

- `app/(dashboard)/workspace/WorkspaceClient.tsx`
