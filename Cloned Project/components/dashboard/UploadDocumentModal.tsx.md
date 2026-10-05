# `components/dashboard/UploadDocumentModal.tsx`

> React component `UploadDocumentModal`.

**Kind:** React component · **Lines:** 479 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Upload`×4 (lucide-react), `X`×2 (lucide-react), `Loader2`×2 (lucide-react), `FileText` (lucide-react), `AlertTriangle` (lucide-react)

### Props

- **`UploadDocumentModal`**: `isOpen: boolean`, `onClose: () => void`, `onSuccess: (ctx: Context) => void`, `authCurrent: Record<string, string>`

**Hooks used:** `useState`×7, `useCallback`×4, `useRef`, `useMemo`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `UploadDocumentModal` | component | `UploadDocumentModal({ isOpen, onClose, onSuccess, authCurrent, }: UploadDocumen…)` | 89 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/auth.ts` — `getOrgId`
- **Packages:**
  - `react` — `useCallback`, `useMemo`, `useRef`, `useState`
  - `sonner` — `toast`
  - `lucide-react` — `AlertTriangle`, `FileText`, `Loader2`, `Upload`, `X`

## Used by

- `components/dashboard/ManualContextsView.tsx`
