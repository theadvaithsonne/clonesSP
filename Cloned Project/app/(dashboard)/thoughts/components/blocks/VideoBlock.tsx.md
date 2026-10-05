# `app/(dashboard)/thoughts/components/blocks/VideoBlock.tsx`

> Module exporting `videoBlock`.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 205 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Link2`×2 (lucide-react), `CustomVideoPlayer` (components/dashboard/CustomVideoPlayer.tsx), `X` (lucide-react), `Video` (lucide-react), `Upload` (lucide-react), `VideoRenderer` (local)

**Hooks used:** `useState`×5, `useCallback`×3, `useRef`×2, `useEffect`×2

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `videoBlock` | const | `= createReactBlockSpec( { type: "video" as const, propSchema: { url: { default: "", type: "string" …` | 187 |

## Interfaces

- **Next.js API routes called (same origin):**
  - `POST /api/uploadthing/delete` (L67)
- **External hosts mentioned in the code:** `www.youtube.com`, `player.vimeo.com`

## Dependencies

- **Internal:**
  - `utils/uploadthing.ts` — `uploadFiles`
  - `components/dashboard/CustomVideoPlayer.tsx` — `CustomVideoPlayer (default)`
- **Packages:**
  - `react` — `useState`, `useCallback`, `useRef`, `useEffect`
  - `lucide-react` — `Video`, `Upload`, `X`, `Link2`
  - `@blocknote/react` — `createReactBlockSpec`
  - `sonner` — `toast`

## Used by

- `app/(dashboard)/thoughts/components/blocks/index.ts`
