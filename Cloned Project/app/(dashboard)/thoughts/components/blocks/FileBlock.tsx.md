# `app/(dashboard)/thoughts/components/blocks/FileBlock.tsx`

> Module exporting `fileBlock`.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 207 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `FileText` (lucide-react), `ExternalLink` (lucide-react), `X` (lucide-react), `FileIcon` (lucide-react), `Upload` (lucide-react), `FileRenderer` (local)

**Hooks used:** `useState`×3, `useCallback`×2, `useRef`, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `fileBlock` | const | `= createReactBlockSpec( { type: "file" as const, propSchema: { url: { default: "", type: "string" }…` | 175 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `utils/uploadthing.ts` — `uploadFiles`
- **Packages:**
  - `react` — `useState`, `useCallback`, `useRef`, `useEffect`
  - `lucide-react` — `FileText`, `Upload`, `X`, `ExternalLink`, `File as FileIcon`
  - `@blocknote/react` — `createReactBlockSpec`
  - `sonner` — `toast`

## Used by

- `app/(dashboard)/thoughts/components/blocks/index.ts`
