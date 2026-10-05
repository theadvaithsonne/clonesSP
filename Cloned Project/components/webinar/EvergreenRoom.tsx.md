# `components/webinar/EvergreenRoom.tsx`

> Evergreen (pre-recorded, scheduled) webinar player.

**Kind:** React component · **Lines:** 517 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
Evergreen (pre-recorded, scheduled) webinar player.

Renders INSTEAD of the live SFU room when a webinar has evergreen enabled —
WebinarRoomClient branches to this before it would ever join mediasoup, so
the live path stays byte-identical for every normal webinar.

The whole illusion rests on one rule: position comes from the SERVER, never
from this component. `positionSec` is computed as (now - sessionStart) on the
backend, so two people who open the page ten minutes apart land on the same
second of the video. See /public/webinar/:id/evergreen-state and
docs/superpowers/specs/2026-09-07-evergreen-webinars-design.md.

The chrome deliberately mirrors the live room (same shell, header card,
#webinar-stage and right sidebar) so an attendee cannot tell the two apart.
It is a copy rather than a shared import on purpose: the live room's header
components read the mediasoup-backed webinar store (peers, socket status, […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Centered`×6 (local), `Check` (lucide-react), `Share2` (lucide-react), `MessageSquare` (lucide-react), `FullscreenButton` (components/webinar/FullscreenButton.tsx), `X` (lucide-react)

### Props

- **`EvergreenRoom`**: `webinarId: string`, `title?: string`, `sessionDate?: string`

**Hooks used:** `useState`×9, `useRef`×3, `useCallback`×2, `useEffect`×2

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (EvergreenRoom)` | component | `EvergreenRoom({ webinarId, title, sessionDate, }: { webinarId: string; ti…)` | 124 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/public/webinar/${webinarId}/evergreen-state${qs}` (L167)
- **Environment variables (`process.env`):** `NEXT_PUBLIC_API_URL`
- **Timers / queues:** `setInterval` at L196, L214; `setTimeout` at L280

## Dependencies

- **Internal:**
  - `components/webinar/FullscreenButton.tsx` — `FullscreenButton (default)`
- **Packages:**
  - `react` — `useCallback`, `useEffect`, `useRef`, `useState`
  - `lucide-react` — `Check`, `MessageSquare`, `Share2`, `X`
  - `sonner` — `toast`

## Used by

- `app/webinar/[id]/WebinarRoomClient.tsx`
