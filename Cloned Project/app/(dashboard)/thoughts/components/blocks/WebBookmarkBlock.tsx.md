# `app/(dashboard)/thoughts/components/blocks/WebBookmarkBlock.tsx`

> Module exporting `webBookmarkBlock`.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 156 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Globe`×3 (lucide-react), `ExternalLink` (lucide-react), `X` (lucide-react), `WebBookmarkRenderer` (local)

**Hooks used:** `useState`×3, `useEffect`×2, `useCallback`×2, `useRef`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `webBookmarkBlock` | const | `= createReactBlockSpec( { type: "webBookmark" as const, propSchema: { url: { default: "", type: "st…` | 141 |

## Interfaces

- **External hosts mentioned in the code:** `www.google.com`

## Dependencies

- **Internal:** none
- **Packages:**
  - `react` — `useState`, `useCallback`, `useRef`, `useEffect`
  - `lucide-react` — `Globe`, `ExternalLink`, `X`
  - `@blocknote/react` — `createReactBlockSpec`

## Used by

- `app/(dashboard)/thoughts/components/blocks/index.ts`
