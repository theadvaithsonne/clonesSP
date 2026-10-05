# `components/dashboard/docusign/shared/FolderNameDialog.tsx`

> React component `FolderNameDialog`.

**Kind:** React component · **Lines:** 82 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Button`×2 (components/ui/button.tsx), `Dialog` (components/ui/dialog.tsx), `DialogContent` (components/ui/dialog.tsx), `DialogHeader` (components/ui/dialog.tsx), `DialogTitle` (components/ui/dialog.tsx), `DialogDescription` (components/ui/dialog.tsx), `Label` (components/ui/label.tsx), `Input` (components/ui/input.tsx), `Loader2` (lucide-react)

### Props

- **`FolderNameDialog`**: `open: boolean`, `onClose: () => void`, `title: string`, `description?: string`, `submitLabel: string`, `initialName?: string`, `onSubmit: (name: string) => Promise<void>`

**Hooks used:** `useState`×2, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `MAX_FOLDER_NAME` | const | `= 80` | 12 |
| `FolderNameDialog` | component | `FolderNameDialog({ open, onClose, title, description, submitLabel, initialNa…)` | 26 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/ui/dialog.tsx` — `Dialog`, `DialogContent`, `DialogDescription`, `DialogHeader`, `DialogTitle`
  - `components/ui/button.tsx` — `Button`
  - `components/ui/input.tsx` — `Input`
  - `components/ui/label.tsx` — `Label`
- **Packages:**
  - `react` — `useEffect`, `useState`
  - `sonner` — `toast`
  - `lucide-react` — `Loader2`

## Used by

- `components/dashboard/docusign/external/ExternalSignaturesList.tsx`
- `components/dashboard/docusign/internal/AgreementsView.tsx`
- `components/dashboard/docusign/shared/FolderSelect.tsx`
