# `components/dashboard/ManualContextsView.tsx`

> React component `ManualContextsView`.

**Kind:** React component · **Lines:** 420 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Loader2`×3 (lucide-react), `BookOpen`×2 (lucide-react), `Upload`×2 (lucide-react), `Plus`×2 (lucide-react), `FileText` (lucide-react), `ChevronRight` (lucide-react), `Edit3` (lucide-react), `Eye` (lucide-react), `Trash2` (lucide-react), `Check` (lucide-react), `ReactMarkdown` (react-markdown), `UploadDocumentModal` (components/dashboard/UploadDocumentModal.tsx)

### Props

- **`ManualContextsView`**: `authCurrent: any`

**Hooks used:** `useState`×10, `useCallback`×3, `useRef`×2, `useEffect`×2

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `ManualContextsView` | component | `ManualContextsView({ authCurrent }: { authCurrent: any })` | 31 |

## Interfaces

- **Timers / queues:** `setTimeout` at L119

## Dependencies

- **Internal:**
  - `lib/auth.ts` — `getOrgId`
  - `components/dashboard/UploadDocumentModal.tsx` — `UploadDocumentModal`
- **Packages:**
  - `react` — `useEffect`, `useState`, `useRef`, `useCallback`
  - `sonner` — `toast`
  - `lucide-react` — `BookOpen`, `Plus`, `Trash2`, `Loader2`, `Check`, `FileText`, …
  - `react-markdown`
  - `remark-gfm`

## Used by

- `components/dashboard/OpenClawContextsPage.tsx`
