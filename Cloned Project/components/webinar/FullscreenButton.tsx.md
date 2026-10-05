# `components/webinar/FullscreenButton.tsx`

> React component `FullscreenButton`.

**Kind:** React component · **Lines:** 83 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Minimize2` (lucide-react), `Maximize2` (lucide-react)

**Hooks used:** `useState`, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (FullscreenButton)` | component | `FullscreenButton()` — Fullscreen scoped to the live stream stage rather than the document, so only the video area expands — the browser shell and the surrounding page chrome stay out of it. | 24 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:** none
- **Packages:**
  - `react` — `useEffect`, `useState`
  - `lucide-react` — `Maximize2`, `Minimize2`
  - `sonner` — `toast`

## Used by

- `app/webinar/[id]/WebinarRoomClient.tsx`
- `components/webinar/EvergreenRoom.tsx`
