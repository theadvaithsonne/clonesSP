# `components/webinar/SimulatedAudienceSettings.tsx`

> Simulated audience — fabricated attendees and chat for a LIVE webinar.

**Kind:** React component · **Lines:** 342 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
Simulated audience — fabricated attendees and chat for a LIVE webinar.

Generation is AI-assisted but never automatic: the model proposes a roster
and a timed script, the host edits them here, and nothing shows in a room
until they turn it on. Timings are seconds from when the host actually goes
live, so a session that starts late doesn't dump its backlog at once.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Loader2`×2 (lucide-react), `Sparkles` (lucide-react), `Trash2` (lucide-react)

### Props

- **`SimulatedAudienceSettings`**: `workshopId: string`

**Hooks used:** `useState`×5, `useRef`, `useCallback`, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (SimulatedAudienceSettings)` | component | `SimulatedAudienceSettings({ workshopId }: { workshopId: string })` | 50 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/simulated-audience/${workshopId}${path}` (L68)
- **Environment variables (`process.env`):** `NEXT_PUBLIC_API_URL`

## Dependencies

- **Internal:**
  - `lib/auth.ts` — `getToken`
- **Packages:**
  - `react` — `useCallback`, `useEffect`, `useRef`, `useState`
  - `sonner` — `toast`
  - `lucide-react` — `Loader2`, `Sparkles`, `Trash2`

## Used by

- `components/dashboard/WorkshopsPage.tsx`
