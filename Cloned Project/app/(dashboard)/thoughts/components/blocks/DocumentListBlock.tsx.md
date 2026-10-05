# `app/(dashboard)/thoughts/components/blocks/DocumentListBlock.tsx`

> Module exporting `documentListBlock`.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 197 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `React` (react), `ExternalLink` (lucide-react), `Upload` (lucide-react), `X` (lucide-react), `Plus` (lucide-react), `DocumentListBlock` (local)

**Hooks used:** `useCallback`×5, `useRef`×3, `useState`×2

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `documentListBlock` | const | `= createReactBlockSpec( { type: "documentList" as const, propSchema: { items: { default: "", type: …` | 185 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `utils/uploadthing.ts` — `uploadFiles`
- **Packages:**
  - `react` — `useState`, `useCallback`, `useRef`
  - `lucide-react` — `FileText`, `Plus`, `Upload`, `ExternalLink`, `X`
  - `@blocknote/react` — `createReactBlockSpec`
  - `sonner` — `toast`

## Used by

- `app/(dashboard)/thoughts/components/blocks/index.ts`
