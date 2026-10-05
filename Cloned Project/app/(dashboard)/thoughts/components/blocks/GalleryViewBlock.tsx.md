# `app/(dashboard)/thoughts/components/blocks/GalleryViewBlock.tsx`

> Module exporting `galleryViewBlock`.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 206 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `ImageUp` (lucide-react), `X` (lucide-react), `Plus` (lucide-react), `GalleryBlock` (local)

**Hooks used:** `useCallback`×5, `useRef`×3, `useState`×2

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `galleryViewBlock` | const | `= createReactBlockSpec( { type: "galleryView" as const, propSchema: { cards: { default: "", type: "…` | 194 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `utils/uploadthing.ts` — `uploadFiles`
- **Packages:**
  - `react` — `useState`, `useCallback`, `useRef`
  - `lucide-react` — `ImageUp`, `Plus`, `X`
  - `@blocknote/react` — `createReactBlockSpec`
  - `sonner` — `toast`

## Used by

- `app/(dashboard)/thoughts/components/blocks/index.ts`
