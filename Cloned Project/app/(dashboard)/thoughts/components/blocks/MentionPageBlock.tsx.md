# `app/(dashboard)/thoughts/components/blocks/MentionPageBlock.tsx`

> Module exporting `mentionPageBlock`.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 218 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `FileText`×3 (lucide-react), `NotePageHoverCard` (app/(dashboard)/thoughts/components/NotePageHoverCard.tsx), `Loader2` (lucide-react), `PageTypeBadge` (app/(dashboard)/thoughts/components/NotePageHoverCard.tsx), `MentionPageRenderer` (local)

**Hooks used:** `useState`×4, `useEffect`×3, `useRef`×2, `useCallback`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `mentionPageBlock` | const | `= createReactBlockSpec( { type: "mentionPage" as const, propSchema: { pageName: { default: "", type…` | 202 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/api-config.ts` — `buildExternalUrl`
  - `utils/api.ts` — `authenticatedFetch`
  - `app/(dashboard)/thoughts/components/NotePageHoverCard.tsx` — `NotePageHoverCard (default)`, `PageTypeBadge`
- **Packages:**
  - `react` — `useState`, `useRef`, `useEffect`, `useCallback`
  - `lucide-react` — `FileText`, `Loader2`
  - `@blocknote/react` — `createReactBlockSpec`

## Used by

- `app/(dashboard)/thoughts/components/blocks/index.ts`
