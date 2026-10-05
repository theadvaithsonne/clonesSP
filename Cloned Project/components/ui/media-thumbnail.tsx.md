# `components/ui/media-thumbnail.tsx`

> React component `MediaThumbnail`.

**Kind:** UI primitive (shadcn/Radix wrapper) · **Lines:** 152 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Play`×2 (lucide-react)

### Props

- **`MediaThumbnail`**: `src: string`, `type: string`, `alt?: string`, `className?: string`, `onClick?: () => void`

**Hooks used:** `useState`×3, `useRef`, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `MediaThumbnail` | component | `MediaThumbnail({ src, type, alt = "Media", className, onClick, }: MediaThu…)` | 15 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/utils.ts` — `cn`
- **Packages:**
  - `react` — `useState`, `useRef`, `useEffect`
  - `lucide-react` — `Play`

## Used by

- `components/dashboard/DMPage.tsx`
- `components/dashboard/GlobalDMPage.tsx`
- `components/dashboard/GroupChatPage.tsx`
