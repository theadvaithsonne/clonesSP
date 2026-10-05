# `components/dashboard/TodoMenu.tsx`

> React component `TodoMenu`.

**Kind:** React component · **Lines:** 344 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Button`×8 (components/ui/button.tsx), `AnimatePresence`×2 (framer-motion), `X`×2 (lucide-react), `Input`×2 (components/ui/input.tsx), `CheckSquare` (lucide-react), `Plus` (lucide-react), `Clock` (lucide-react), `Check` (lucide-react), `Edit2` (lucide-react), `Trash2` (lucide-react)

### Props

- **`TodoMenu`**: `isOpen: boolean`, `onClose: () => void`

**Hooks used:** `useState`×5, `useRef`×2, `useEffect`×2, `useTodos` (lib/hooks/useTodos.ts)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `TodoMenu` | component | `TodoMenu({ isOpen, onClose }: TodoMenuProps)` | 24 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/ui/button.tsx` — `Button`
  - `components/ui/input.tsx` — `Input`
  - `lib/utils.ts` — `cn`
  - `lib/hooks/useTodos.ts` — `useTodos`
- **Packages:**
  - `react` — `useState`, `useRef`, `useEffect`
  - `framer-motion` — `motion`, `AnimatePresence`
  - `lucide-react` — `CheckSquare`, `Plus`, `X`, `Edit2`, `Trash2`, `Check`, …

## Used by

- `app/(dashboard)/workspace/WorkspaceClient.tsx`
- `app/(dashboard)/workspace/components/WorkspaceToolbar.tsx`
