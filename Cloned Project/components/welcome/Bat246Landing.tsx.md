# `components/welcome/Bat246Landing.tsx`

> React component `Bat246Landing`.

**Kind:** React component · **Lines:** 1148 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `JoinNow`×2 (local), `Image` (next/image), `AccessCodeSlot` (local), `Radio` (lucide-react), `Lock` (lucide-react), `X` (lucide-react)

### Props

- **`Bat246Landing`**: `webinar: { id: string; title: string; live: boolean } | null`, `referralCode?: string | null`

**Hooks used:** `useEffect`×8, `useCallback`×7, `useState`×6, `useRouter` (next/navigation), `useSearchParams` (next/navigation), `useIsMobile` (hooks/use-mobile.ts), `useRef`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (Bat246Landing)` | component | `Bat246Landing({ webinar, referralCode, }: { webinar: { id: string; title:…)` | 92 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/public/webinar/validate?id=${webinar.id}` (L185)
- **Environment variables (`process.env`):** `NEXT_PUBLIC_API_URL`
- **Timers / queues:** `setInterval` at L199; `setTimeout` at L326
- **External hosts mentioned in the code:** `my.garage.app`, `bat246.com`, `yourmoneyback.info`

## Dependencies

- **Internal:**
  - `lib/webinar/bat246GuestSession.ts` — `readBat246GuestSession`
  - `hooks/use-mobile.ts` — `useIsMobile`
  - `lib/webinar/bat246VideoGate.ts` — `WATCH_KEY`, `VIDEOS_KEY`, `WATCHED_KEY`, `REQUIRED_WEBINAR_SECONDS`, `REQUIRED_VIDEOS`, `TileId`, `readUnlocks`, `persistUnlocks`, … +1
- **Packages:**
  - `react` — `useCallback`, `useEffect`, `useRef`, `useState`
  - `next` — `useRouter`, `useSearchParams`
  - `framer-motion` — `motion`
  - `lucide-react` — `Radio`, `X`, `Lock`
  - `sonner` — `toast`

## Used by

- `components/welcome/Welcome.tsx`
