# `app/(dashboard)/thoughts/components/blocks/BoardViewBlock.tsx`

> Module exporting `boardViewBlock`.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 324 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `GripVertical` (lucide-react), `Trash2` (lucide-react), `Plus` (lucide-react), `BoardBlock` (local)

**Hooks used:** `useCallback`×10, `useState`×3, `useRef`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `boardViewBlock` | const | `= createReactBlockSpec( { type: "boardView" as const, propSchema: { columns: { default: "", type: "…` | 312 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:** none
- **Packages:**
  - `react` — `useState`, `useCallback`, `useRef`
  - `lucide-react` — `GripVertical`, `Plus`, `Trash2`
  - `@blocknote/react` — `createReactBlockSpec`

## Used by

- `app/(dashboard)/thoughts/components/blocks/index.ts`
