# `components/webinar/VirtualBackgroundPicker.tsx`

> React component `VirtualBackgroundPicker`.

**Kind:** React component · **Lines:** 177 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Loader2` (lucide-react), `X` (lucide-react), `Ban` (lucide-react)

### Props

- **`VirtualBackgroundPicker`**: `backgroundType: BackgroundType`, `backgroundImage: string`, `isProcessing: boolean`

**Hooks used:** `useRef`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (VirtualBackgroundPicker)` | component | `VirtualBackgroundPicker({ backgroundType, backgroundImage, isProcessing, onSetBlur,…)` | 46 |

## Interfaces

- **External hosts mentioned in the code:** `images.unsplash.com`

## Dependencies

- **Internal:**
  - `hooks/webinar/useVirtualBackground.ts` — `BackgroundType`, `(types only)`
- **Packages:**
  - `react` — `useRef`
  - `lucide-react` — `Ban`, `Loader2`, `X`

## Used by

- `components/webinar/ControlBar.tsx`
