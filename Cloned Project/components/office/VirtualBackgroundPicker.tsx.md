# `components/office/VirtualBackgroundPicker.tsx`

> React component `VirtualBackgroundPicker`.

**Kind:** React component · **Lines:** 124 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Loader2` (lucide-react), `Ban` (lucide-react)

### Props

- **`VirtualBackgroundPicker`**: `backgroundType: BackgroundType`, `backgroundImage: string`, `isProcessing: boolean`

**Hooks used:** `useRef`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (VirtualBackgroundPicker)` | component | `VirtualBackgroundPicker({ backgroundType, backgroundImage, isProcessing, onSetBlur,…)` | 24 |

## Interfaces

- **External hosts mentioned in the code:** `images.unsplash.com`

## Dependencies

- **Internal:**
  - `hooks/office/useVirtualBackground.ts` — `BackgroundType`, `(types only)`
- **Packages:**
  - `react` — `useRef`
  - `lucide-react` — `Ban`, `Loader2`

## Used by

- `app/meet/conference/[orgId]/[roomId]/ConferenceCallStandalone.tsx`
- `components/office/ControlBar.tsx`
