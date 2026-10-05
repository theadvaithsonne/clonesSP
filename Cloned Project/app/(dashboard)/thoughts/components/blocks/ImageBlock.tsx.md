# `app/(dashboard)/thoughts/components/blocks/ImageBlock.tsx`

> Module exporting `imageBlock`.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 202 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Link2`×2 (lucide-react), `X` (lucide-react), `Image` (lucide-react), `Upload` (lucide-react), `ImageRenderer` (local)

**Hooks used:** `useState`×4, `useCallback`×3, `useRef`×2, `useEffect`×2

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `imageBlock` | const | `= createReactBlockSpec( { type: "image" as const, propSchema: { url: { default: "", type: "string" …` | 183 |

## Interfaces

- **Next.js API routes called (same origin):**
  - `POST /api/uploadthing/delete` (L77)

## Dependencies

- **Internal:**
  - `utils/uploadthing.ts` — `uploadFiles`
- **Packages:**
  - `react` — `useState`, `useCallback`, `useRef`, `useEffect`
  - `lucide-react` — `Image`, `Upload`, `X`, `Link2`
  - `@blocknote/react` — `createReactBlockSpec`
  - `sonner` — `toast`

## Used by

- `app/(dashboard)/thoughts/components/blocks/index.ts`
