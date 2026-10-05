# `app/(dashboard)/thoughts/components/blocks/NestedPageBlock.tsx`

> Module exporting `nestedPageBlock`.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 389 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `FileText`×2 (lucide-react), `ChevronDown` (lucide-react), `Search` (lucide-react), `Loader2` (lucide-react), `PageTypeBadge` (app/(dashboard)/thoughts/components/NotePageHoverCard.tsx), `NotePageHoverCard` (app/(dashboard)/thoughts/components/NotePageHoverCard.tsx), `NestedPageRenderer` (local)

**Hooks used:** `useState`×6, `useEffect`×6, `useCallback`×5, `useRef`×3

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `nestedPageBlock` | const | `= createReactBlockSpec( { type: "nestedPage" as const, propSchema: { title: { default: "Untitled Pa…` | 374 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/api-config.ts` — `buildExternalUrl`
  - `utils/api.ts` — `authenticatedFetch`
  - `app/(dashboard)/thoughts/components/NotePageHoverCard.tsx` — `NotePageHoverCard (default)`, `PageTypeBadge`
- **Packages:**
  - `react` — `useState`, `useRef`, `useEffect`, `useCallback`
  - `lucide-react` — `FileText`, `ChevronDown`, `Search`, `Loader2`
  - `@blocknote/react` — `createReactBlockSpec`

## Used by

- `app/(dashboard)/thoughts/components/blocks/index.ts`
