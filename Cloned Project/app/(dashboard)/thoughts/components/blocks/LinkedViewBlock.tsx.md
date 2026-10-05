# `app/(dashboard)/thoughts/components/blocks/LinkedViewBlock.tsx`

> Module exporting `linkedViewBlock`.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 416 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Plus`×2 (lucide-react), `Link2` (lucide-react), `Settings2` (lucide-react), `Icon` (local), `ViewIcon` (local), `ChevronRight` (lucide-react), `GripHorizontal` (lucide-react), `Trash2` (lucide-react), `LinkedViewRenderer` (local)

**Hooks used:** `useCallback`×7, `useState`×6, `useEffect`×3, `useRef`×2

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `linkedViewBlock` | const | `= createReactBlockSpec( { type: "linkedView" as const, propSchema: { viewType: { default: "table", …` | 402 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:** none
- **Packages:**
  - `react` — `useState`, `useCallback`, `useRef`, `useEffect`
  - `lucide-react` — `Link2`, `ChevronRight`, `Settings2`, `ExternalLink`, `Table`, `BarChart3`, …
  - `@blocknote/react` — `createReactBlockSpec`

## Used by

- `app/(dashboard)/thoughts/components/blocks/index.ts`
