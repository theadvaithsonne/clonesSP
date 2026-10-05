# `app/(dashboard)/thoughts/components/blocks/PageLinkPillBlock.tsx`

> Module exporting `pageLinkPillBlock`.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 239 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `FileText`×2 (lucide-react), `Pencil` (lucide-react), `Search` (lucide-react), `Loader2` (lucide-react), `PageTypeBadge` (app/(dashboard)/thoughts/components/NotePageHoverCard.tsx), `NotePageHoverCard` (app/(dashboard)/thoughts/components/NotePageHoverCard.tsx), `PageLinkPillRenderer` (local)

**Hooks used:** `useState`×4, `useEffect`×3, `useRef`×2, `useCallback`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `pageLinkPillBlock` | const | `= createReactBlockSpec( { type: "pageLinkPill" as const, propSchema: { targetPage: { default: "", t…` | 223 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/api-config.ts` — `buildExternalUrl`
  - `utils/api.ts` — `authenticatedFetch`
  - `app/(dashboard)/thoughts/components/NotePageHoverCard.tsx` — `NotePageHoverCard (default)`, `PageTypeBadge`
- **Packages:**
  - `react` — `useState`, `useRef`, `useEffect`, `useCallback`
  - `lucide-react` — `FileText`, `Pencil`, `Loader2`, `Search`
  - `@blocknote/react` — `createReactBlockSpec`

## Used by

- `app/(dashboard)/thoughts/components/blocks/index.ts`
