# `components/dashboard/SidePeekPanel.tsx`

> React component `SidePeekPanel`.

**Kind:** React component · **Lines:** 230 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `AnimatePresence` (framer-motion), `AppWindow` (lucide-react), `Maximize2` (lucide-react), `X` (lucide-react)

### Props

- **`SidePeekPanel`**: `peek: SidePeek | null`, `rightOffset: number`, `tabOpen: boolean`, `onClose: () => void`, `onOpenFullPage: () => void`, `onOpenInNewTab: () => void`, `children: ReactNode`

**Hooks used:** `useState`×3, `useEffect`×3, `useRef`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `SidePeek` | interface |  | 27 |
| `default (SidePeekPanel)` | component | `SidePeekPanel({ peek, rightOffset, tabOpen, onClose, onOpenFullPage, onOp…)` — A page opened beside the current one ("Open in side peek" in the sidebar's right-click menu). | 58 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/utils.ts` — `cn`
- **Packages:**
  - `react` — `useEffect`, `useRef`, `useState`, `CSSProperties`, `PointerEvent as ReactPointerEvent`, `ReactNode`
  - `framer-motion` — `AnimatePresence`, `motion`
  - `lucide-react` — `AppWindow`, `Maximize2`, `X`

## Used by

- `app/(dashboard)/layout.tsx`
