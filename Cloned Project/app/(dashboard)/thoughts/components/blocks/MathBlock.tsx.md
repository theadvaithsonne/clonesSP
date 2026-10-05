# `app/(dashboard)/thoughts/components/blocks/MathBlock.tsx`

> Module exporting `mathBlock`.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 116 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Sigma` (lucide-react), `MathRenderer` (local)

**Hooks used:** `useState`×2, `useEffect`×2, `useRef`, `useCallback`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `mathBlock` | const | `= createReactBlockSpec( { type: "math" as const, propSchema: { expression: { default: "", type: "st…` | 102 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:** none
- **Packages:**
  - `react` — `useState`, `useCallback`, `useRef`, `useEffect`
  - `lucide-react` — `Sigma`
  - `@blocknote/react` — `createReactBlockSpec`

## Used by

- `app/(dashboard)/thoughts/components/blocks/index.ts`
