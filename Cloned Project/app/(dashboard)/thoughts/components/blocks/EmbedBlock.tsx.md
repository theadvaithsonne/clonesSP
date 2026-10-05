# `app/(dashboard)/thoughts/components/blocks/EmbedBlock.tsx`

> Module exporting `embedBlock`.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 132 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Hexagon`×2 (lucide-react), `Globe` (lucide-react), `X` (lucide-react), `EmbedRenderer` (local)

**Hooks used:** `useState`×3, `useEffect`×2, `useCallback`×2, `useRef`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `embedBlock` | const | `= createReactBlockSpec( { type: "embed" as const, propSchema: { url: { default: "", type: "string" …` | 118 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:** none
- **Packages:**
  - `react` — `useState`, `useCallback`, `useRef`, `useEffect`
  - `lucide-react` — `Hexagon`, `Globe`, `X`
  - `@blocknote/react` — `createReactBlockSpec`

## Used by

- `app/(dashboard)/thoughts/components/blocks/index.ts`
