# `components/deals/AddDocumentDialog.tsx`

> React component `AddDocumentDialog`.

**Kind:** React component · **Lines:** 204 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Dialog` (components/ui/dialog.tsx), `DialogContent` (components/ui/dialog.tsx), `DialogTitle` (components/ui/dialog.tsx), `X` (lucide-react), `Loader2` (lucide-react), `Upload` (lucide-react), `FileText` (lucide-react), `Button` (components/ui/button.tsx)

### Props

- **`AddDocumentDialog`**: `open: boolean`, `onOpenChange: (open: boolean) => void`, `onFilesSelected: (files: FileList) => void`, `isUploading?: boolean`

**Hooks used:** `useState`×2, `useRef`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `AddDocumentDialog` | component | `AddDocumentDialog({ open, onOpenChange, onFilesSelected, isUploading = false,…)` | 20 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/ui/button.tsx` — `Button`
  - `components/ui/dialog.tsx` — `Dialog`, `DialogContent`, `DialogTitle`
  - `components/deals/LeadDetailFigmaView.tsx` — `FIGMA`
- **Packages:**
  - `react` — `useRef`, `useState`
  - `lucide-react` — `FileText`, `Loader2`, `Upload`, `X`

## Used by

- `app/(dashboard)/deals/leads/[id]/page.tsx`
