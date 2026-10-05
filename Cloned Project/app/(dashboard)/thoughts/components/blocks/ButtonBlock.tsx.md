# `app/(dashboard)/thoughts/components/blocks/ButtonBlock.tsx`

> Module exporting `buttonBlock`.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 104 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Plus` (lucide-react), `ButtonRenderer` (local)

**Hooks used:** `useState`×2, `useEffect`×2, `useCallback`×2, `useRef`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `buttonBlock` | const | `= createReactBlockSpec( { type: "button" as const, propSchema: { label: { default: "Create Task", t…` | 90 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:** none
- **Packages:**
  - `react` — `useState`, `useCallback`, `useRef`, `useEffect`
  - `lucide-react` — `Plus`
  - `@blocknote/react` — `createReactBlockSpec`

## Used by

- `app/(dashboard)/thoughts/components/blocks/index.ts`
