# `components/dashboard/docusign/shared/FolderSelect.tsx`

> React component `FolderSelect`.

**Kind:** React component · **Lines:** 121 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `SelectItem`×3 (components/ui/select.tsx), `Button`×2 (components/ui/button.tsx), `Input` (components/ui/input.tsx), `Loader2` (lucide-react), `Check` (lucide-react), `X` (lucide-react), `Select` (components/ui/select.tsx), `SelectTrigger` (components/ui/select.tsx), `SelectValue` (components/ui/select.tsx), `SelectContent` (components/ui/select.tsx), `Globe` (lucide-react), `Folder` (lucide-react), `Plus` (lucide-react)

### Props

- **`FolderSelect`**: `scope: FolderScope`, `value: string | null`, `onChange: (folderId: string | null) => void`, `disabled?: boolean`, `id?: string`

**Hooks used:** `useState`×3, `useDocusignStore` (store/docusign/docusignStore.ts)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `FolderSelect` | component | `FolderSelect({ scope, value, onChange, disabled, id }: FolderSelectProps)` | 30 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/ui/select.tsx` — `Select`, `SelectContent`, `SelectItem`, `SelectTrigger`, `SelectValue`
  - `components/ui/button.tsx` — `Button`
  - `components/ui/input.tsx` — `Input`
  - `store/docusign/docusignStore.ts` — `useDocusignStore`
  - `lib/docusign/shared-api.ts` — `createFolder`, `FolderScope`
  - `components/dashboard/docusign/shared/FolderNameDialog.tsx` — `MAX_FOLDER_NAME`
- **Packages:**
  - `react` — `useState`
  - `sonner` — `toast`
  - `lucide-react` — `Check`, `Globe`, `Loader2`, `Plus`, `X`, `Folder`

## Used by

- `components/dashboard/docusign/external/ExternalDocumentUploadDialog.tsx`
- `components/dashboard/docusign/internal/DocumentUploadDialog.tsx`
- `components/dashboard/docusign/shared/MoveToFolderDialog.tsx`
