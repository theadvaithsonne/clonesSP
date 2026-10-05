# `components/dashboard/docusign/shared/MoveToFolderDialog.tsx`

> React component `MoveToFolderDialog`.

**Kind:** React component · **Lines:** 82 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Button`×2 (components/ui/button.tsx), `Dialog` (components/ui/dialog.tsx), `DialogContent` (components/ui/dialog.tsx), `DialogHeader` (components/ui/dialog.tsx), `DialogTitle` (components/ui/dialog.tsx), `DialogDescription` (components/ui/dialog.tsx), `Label` (components/ui/label.tsx), `FolderSelect` (components/dashboard/docusign/shared/FolderSelect.tsx), `Loader2` (lucide-react)

### Props

- **`MoveToFolderDialog`**: `open: boolean`, `onClose: () => void`, `documentIds: string[]`, `initialFolderId?: string | null`, `onMoved: () => void`, `scope: FolderScope`, `moveFn: (documentIds: string[], folderId: string | null) => Promise<{…`

**Hooks used:** `useState`×2, `useDocusignStore` (store/docusign/docusignStore.ts), `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `MoveToFolderDialog` | component | `MoveToFolderDialog({ open, onClose, documentIds, scope, initialFolderId = null…)` | 28 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/ui/dialog.tsx` — `Dialog`, `DialogContent`, `DialogDescription`, `DialogHeader`, `DialogTitle`
  - `components/ui/button.tsx` — `Button`
  - `components/ui/label.tsx` — `Label`
  - `store/docusign/docusignStore.ts` — `useDocusignStore`
  - `lib/docusign/shared-api.ts` — `FolderScope`, `(types only)`
  - `components/dashboard/docusign/shared/FolderSelect.tsx` — `FolderSelect`
- **Packages:**
  - `react` — `useEffect`, `useState`
  - `sonner` — `toast`
  - `lucide-react` — `Loader2`

## Used by

- `components/dashboard/docusign/external/ExternalSignaturesList.tsx`
- `components/dashboard/docusign/internal/AgreementsView.tsx`
