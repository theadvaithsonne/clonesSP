# `components/ui/file-upload.tsx`

> React component `FileUpload`.

**Kind:** UI primitive (shadcn/Radix wrapper) · **Lines:** 144 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Button`×2 (components/ui/button.tsx), `X` (lucide-react), `Upload` (lucide-react)

### Props

- **`FileUpload`**: `onUpload: (file: File) => Promise<string>`, `onRemove?: () => void`, `currentUrl?: string`, `accept?: string`, `maxSize?: number`, `className?: string`, `placeholder?: string`, `description?: string`

**Hooks used:** `useState`×2, `useRef`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `FileUpload` | component | `FileUpload({ onUpload, onRemove, currentUrl, accept = "image/*", maxSi…)` | 20 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/ui/button.tsx` — `Button`
  - `lib/utils.ts` — `cn`
- **Packages:**
  - `react` — `useState`, `useRef`
  - `lucide-react` — `Upload`, `X`, `Check`

## Used by

No other file imports this one and it has no automatic entry point — it appears unused (or is loaded dynamically by a path the import graph cannot see).
