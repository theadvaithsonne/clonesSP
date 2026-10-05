# `app/(dashboard)/workspace/components/DraggableCameraBubble.tsx`

> React component `DraggableCameraBubble`.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 179 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `AnimatePresence` (framer-motion)

### Props

- **`DraggableCameraBubble`**: `stream: MediaStream | null`, `isVisible: boolean`, `onPositionChange?: (x: number, y: number, size: number) => void`

**Hooks used:** `useRef`×4, `useEffect`×4, `useCallback`×4, `useState`×3

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `DraggableCameraBubble` | component | `DraggableCameraBubble({ stream, isVisible, onPositionChange }: DraggableCameraBub…)` | 12 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:** none
- **Packages:**
  - `react` — `useRef`, `useState`, `useEffect`, `useCallback`
  - `framer-motion` — `motion`, `AnimatePresence`

## Used by

- `app/(dashboard)/workspace/WorkspaceClient.tsx`
