# `app/docs/components/Chrome.tsx`

> React component `Chrome`.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 107 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Link`×3 (next/link), `X` (lucide-react), `Menu` (lucide-react), `Search` (lucide-react), `Palette` (app/docs/components/Palette.tsx)

### Props

- **`Chrome`**: `children: React.ReactNode`

**Hooks used:** `useState`×2, `useEffect`×2, `usePathname` (next/navigation)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (Chrome)` | component | `Chrome({ children }: { children: React.ReactNode })` — Top bar, chapter navigation and the search palette. | 17 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `app/docs/content/index.ts` — `PARTS`
  - `app/docs/components/Palette.tsx` — `Palette (default)`
- **Packages:**
  - `react` — `useEffect`, `useState`
  - `next` — `usePathname`
  - `lucide-react` — `Menu`, `Search`, `X`

## Used by

- `app/docs/layout.tsx`
