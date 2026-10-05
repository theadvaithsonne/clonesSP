# `components/webinar/EvergreenSettings.tsx`

> Evergreen configuration panel for the host: upload a video, script the chat, and turn scheduled playback on.

**Kind:** React component · **Lines:** 527 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
Evergreen configuration panel for the host: upload a video, script the chat,
and turn scheduled playback on.

Additive — a webinar that never opens this keeps `evergreen.enabled === false`
and behaves exactly as a normal live webinar. Enabling is deliberately
guarded (video + duration + a valid recurrence), and the backend enforces the
same rules, so a half-configured webinar can never go "live" playing nothing.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Loader2` (lucide-react), `Upload` (lucide-react), `Trash2` (lucide-react)

### Props

- **`EvergreenSettings`**: `workshopId: string`

**Hooks used:** `useState`×7, `useRef`, `useCallback`, `useEffect`, `useRecording` (local)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (EvergreenSettings)` | component | `EvergreenSettings({ workshopId }: { workshopId: string })` | 63 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/evergreen/${workshopId}${path}` (L75)
- **Environment variables (`process.env`):** `NEXT_PUBLIC_API_URL`

## Dependencies

- **Internal:**
  - `lib/auth.ts` — `getToken`
- **Packages:**
  - `react` — `useCallback`, `useEffect`, `useRef`, `useState`
  - `sonner` — `toast`
  - `lucide-react` — `Loader2`, `Trash2`, `Upload`

## Used by

- `components/dashboard/WorkshopsPage.tsx`
