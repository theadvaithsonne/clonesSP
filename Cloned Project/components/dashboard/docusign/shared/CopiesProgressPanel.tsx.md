# `components/dashboard/docusign/shared/CopiesProgressPanel.tsx`

> React component `CopiesProgressPanel`.

**Kind:** React component · **Lines:** 163 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Loader2`×2 (lucide-react), `CheckCircle2` (lucide-react), `AlertTriangle` (lucide-react), `Button` (components/ui/button.tsx), `RefreshCw` (lucide-react)

### Props

- **`CopiesProgressPanel`**: `documentId: string`, `fetchProgress: (id: string) => Promise<{ status: boolean; data: DsCop…`, `retryProgress: (id: string) => Promise<{ status: boolean; data: DsCop…`

**Hooks used:** `useState`×4, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `CopiesProgressPanel` | component | `CopiesProgressPanel({ documentId, fetchProgress, retryProgress }: CopiesProgres…)` | 32 |

## Interfaces

- **Timers / queues:** `setTimeout` at L53, L64

## Dependencies

- **Internal:**
  - `components/ui/button.tsx` — `Button`
  - `lib/docusign/types.ts` — `DsCopiesProgress`, `(types only)`
- **Packages:**
  - `react` — `useEffect`, `useState`
  - `sonner` — `toast`
  - `lucide-react` — `AlertTriangle`, `CheckCircle2`, `Loader2`, `RefreshCw`

## Used by

- `components/dashboard/docusign/external/ExternalFieldEditorView.tsx`
- `components/dashboard/docusign/internal/FieldEditorView.tsx`
