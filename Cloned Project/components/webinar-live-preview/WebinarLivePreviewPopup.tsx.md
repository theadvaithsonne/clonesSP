# `components/webinar-live-preview/WebinarLivePreviewPopup.tsx`

> React component `WebinarLivePreviewPopup`.

**Kind:** React component · **Lines:** 190 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `AnimatePresence` (framer-motion), `Radio` (lucide-react), `X` (lucide-react), `PreviewVideo` (local), `ExternalLink` (lucide-react), `VolumeX` (lucide-react), `Volume2` (lucide-react)

**Hooks used:** `useEffect`×4, `useRef`×3, `useWebinarLivePreview` (hooks/useWebinarLivePreview.ts), `useMediasoupAudience` (app/(dashboard)/workspace/hooks/useMediasoupAudience.ts), `useState`, `useCallback`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `WebinarLivePreviewPopup` | component | `memo(() => { const { webinar, shouldShow, dismiss, markJoined } = useWebinarLivePreview()…` | 35 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `hooks/useWebinarLivePreview.ts` — `useWebinarLivePreview`
  - `app/(dashboard)/workspace/hooks/useMediasoupAudience.ts` — `useMediasoupAudience`
- **Packages:**
  - `react` — `memo`, `useEffect`, `useRef`, `useCallback`, `useState`
  - `framer-motion` — `AnimatePresence`, `motion`
  - `lucide-react` — `X`, `Volume2`, `VolumeX`, `Radio`, `ExternalLink`

## Used by

No other file imports this one and it has no automatic entry point — it appears unused (or is loaded dynamically by a path the import graph cannot see).
