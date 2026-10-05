# `components/shared/ImageCropDialog.tsx`

> React component `ImageCropDialog`.

**Kind:** React component · **Lines:** 1066 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Loader2`×2 (lucide-react), `Slider`×2 (components/ui/slider.tsx), `X` (lucide-react), `Undo2` (lucide-react), `RotateCcw` (lucide-react), `RotateCw` (lucide-react), `FlipHorizontal` (lucide-react), `FlipVertical` (lucide-react), `ZoomOut` (lucide-react), `ZoomIn` (lucide-react)

### Props

- **`ImageCropDialog`**: `open: boolean`, `source: File | string | null`, `aspect?: number`, `safeAreaAspect?: number`, `storeAspect?: number`, `storeWholeImage?: boolean`, `outputWidth?: number`, `title?: string`, `description?: string`, `confirmLabel?: string`, `busy?: boolean`, `notice?: string`, `initialState?: CropState | null`, `onCancel: () => void`, `onConfirm: (blob: Blob, state: CropState) => void | Promise<void>`

**Hooks used:** `useState`×16, `useEffect`×5, `useRef`×4, `useCallback`×2, `useLayoutEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `CropMode` | type | `fill` crops the image to the frame (nothing empty, edges lost). | 40 |
| `CropBackdrop` | type | What sits behind the image in `fit` mode. | 42 |
| `CropState` | interface | A framing choice, stored independently of the on-screen frame size. | 45 |
| `default (ImageCropDialog)` | component | `ImageCropDialog({ open, source, aspect = 16 / 9, safeAreaAspect, storeAspec…)` | 160 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/ui/slider.tsx` — `Slider`
  - `lib/utils.ts` — `cn`
- **Packages:**
  - `react` — `useCallback`, `useEffect`, `useLayoutEffect`, `useRef`, `useState`
  - `react-dom` — `createPortal`
  - `lucide-react` — `FlipHorizontal`, `FlipVertical`, `Loader2`, `RotateCcw`, `RotateCw`, `Undo2`, …

## Used by

- `components/dashboard/ChannelsPage.tsx`
- `components/dashboard/inlineApps/events/sections/WebsiteSettings.tsx`
- `components/shared/ManageOrgPopover.tsx`
- `lib/coverOriginal.ts`
