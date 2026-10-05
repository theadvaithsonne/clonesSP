# `app/(dashboard)/thoughts/components/blocks/AudioBlock.tsx`

> Module exporting `audioBlock`.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 174 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Music`×2 (lucide-react), `Link2`×2 (lucide-react), `X` (lucide-react), `Upload` (lucide-react), `AudioRenderer` (local)

**Hooks used:** `useState`×4, `useCallback`×3, `useRef`×2, `useEffect`×2

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `audioBlock` | const | `= createReactBlockSpec( { type: "audio" as const, propSchema: { url: { default: "", type: "string" …` | 157 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `utils/uploadthing.ts` — `uploadFiles`
- **Packages:**
  - `react` — `useState`, `useCallback`, `useRef`, `useEffect`
  - `lucide-react` — `Music`, `Upload`, `X`, `Link2`
  - `@blocknote/react` — `createReactBlockSpec`
  - `sonner` — `toast`

## Used by

- `app/(dashboard)/thoughts/components/blocks/index.ts`
