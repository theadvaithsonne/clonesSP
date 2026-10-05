# `components/funnel-studio/preview-canvas.tsx`

> React component `PreviewCanvas`.

**Kind:** React component · **Lines:** 294 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Question`×2 (local), `Image` (next/image), `Screen` (local), `VideoStep` (local), `ProductScreen` (local), `RegisterScreen` (local), `Play` (lucide-react), `ChevronLeft` (lucide-react), `ChevronRight` (lucide-react), `UserPlus` (lucide-react), `ShoppingBag` (lucide-react), `ExternalLink` (lucide-react)

### Props

- **`PreviewCanvas`**: `template: FunnelTemplate`, `selected: Path | null`, `node: FunnelNode | null`, `onSelect: (path: Path | null) => void`, `link?: FunnelLink | null`

**Hooks used:** `useState`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `PreviewCanvas` | component | `PreviewCanvas({ template, selected, node, onSelect, link }: PreviewCanvas…)` | 29 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/funnel-tree.ts` — `FunnelNode`, `FunnelTemplate`, `(types only)`
  - `lib/api/funnels.ts` — `FunnelLink`, `(types only)`
  - `lib/youtube.ts` — `youTubeThumb`
  - `components/funnel-studio/tree-ops.ts` — `Path`
- **Packages:**
  - `react` — `useState`
  - `next`
  - `framer-motion` — `motion`
  - `lucide-react` — `ChevronLeft`, `ChevronRight`, `ExternalLink`, `Play`, `ShoppingBag`, `UserPlus`

## Used by

- `components/funnel-studio/funnel-studio.tsx`
