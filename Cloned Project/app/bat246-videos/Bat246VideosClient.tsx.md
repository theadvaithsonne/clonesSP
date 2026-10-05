# `app/bat246-videos/Bat246VideosClient.tsx`

> React component `Bat246VideosClient`.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 1280 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Play`×4 (lucide-react), `Clock`×2 (lucide-react), `ArrowLeft` (lucide-react), `Lock` (lucide-react), `Info` (lucide-react), `X` (lucide-react), `Maximize` (lucide-react)

**Hooks used:** `useEffect`×15, `useState`×13, `useRef`×4, `useCallback`×3, `useRouter` (next/navigation)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (Bat246VideosClient)` | component | `Bat246VideosClient()` — Bat246 intro-video gallery — a dedicated page (not a modal). | 165 |

## Interfaces

- **Timers / queues:** `setTimeout` at L1209
- **External hosts mentioned in the code:** `my.garage.app`

## Dependencies

- **Internal:**
  - `lib/webinar/bat246VideoGate.ts` — `VIDEOS`, `VIDEOS_KEY`, `WATCHED_KEY`, `REQUIRED_VIDEOS`, `PRODUCT_VIDEO`, `PRODUCT_KEY`, `isVideoUnlocked`, `isVideoPlayable`, … +6
- **Packages:**
  - `react` — `useCallback`, `useEffect`, `useRef`, `useState`
  - `react-dom` — `preload`
  - `next` — `useRouter`
  - `framer-motion` — `motion`
  - `lucide-react` — `ArrowLeft`, `Clock`, `Info`, `Lock`, `Maximize`, `Play`, …

## Used by

- `app/bat246-videos/page.tsx`
