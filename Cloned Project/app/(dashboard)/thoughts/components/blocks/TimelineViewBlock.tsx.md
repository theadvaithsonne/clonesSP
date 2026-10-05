# `app/(dashboard)/thoughts/components/blocks/TimelineViewBlock.tsx`

> Module exporting `timelineViewBlock`.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 646 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `X`×3 (lucide-react), `Plus`×2 (lucide-react), `Calendar`×2 (lucide-react), `GripHorizontal` (lucide-react), `User` (lucide-react), `Trash2` (lucide-react), `TimelineBlock` (local)

**Hooks used:** `useCallback`×9, `useState`×4, `useRef`×4, `useMemo`×2, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `timelineViewBlock` | const | `= createReactBlockSpec( { type: "timelineView" as const, propSchema: { items: { default: "", type: …` | 634 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:** none
- **Packages:**
  - `react` — `useState`, `useCallback`, `useRef`, `useEffect`, `useMemo`
  - `lucide-react` — `Plus`, `GripHorizontal`, `X`, `Calendar`, `User`, `Trash2`
  - `@blocknote/react` — `createReactBlockSpec`

## Used by

- `app/(dashboard)/thoughts/components/blocks/index.ts`
