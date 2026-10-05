# `app/(dashboard)/thoughts/components/blocks/CommentBlock.tsx`

> Module exporting `commentBlock`.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 208 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `MessageCircle`×2 (lucide-react), `X` (lucide-react), `Send` (lucide-react), `CommentRenderer` (local)

**Hooks used:** `useState`×3, `useCallback`×3, `useUser` (context/UserContext.tsx), `useRef`, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `commentBlock` | const | `= createReactBlockSpec( { type: "comment" as const, propSchema: { comments: { default: "[]", type: …` | 194 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `context/UserContext.tsx` — `useUser`
- **Packages:**
  - `react` — `useState`, `useCallback`, `useRef`, `useEffect`
  - `lucide-react` — `MessageCircle`, `Send`, `X`
  - `@blocknote/react` — `createReactBlockSpec`

## Used by

- `app/(dashboard)/thoughts/components/blocks/index.ts`
