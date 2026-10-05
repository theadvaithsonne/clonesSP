# `components/dashboard/docusign/external/ExternalDocumentUploadDialog.tsx`

> React component `ExternalDocumentUploadDialog`.

**Kind:** React component · **Lines:** 155 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Label`×2 (components/ui/label.tsx), `Button`×2 (components/ui/button.tsx), `Dialog` (components/ui/dialog.tsx), `DialogContent` (components/ui/dialog.tsx), `DialogHeader` (components/ui/dialog.tsx), `DialogTitle` (components/ui/dialog.tsx), `PdfFilesPicker` (components/dashboard/docusign/shared/PdfFilesPicker.tsx), `Textarea` (components/ui/textarea.tsx), `FolderSelect` (components/dashboard/docusign/shared/FolderSelect.tsx), `Loader2` (lucide-react)

### Props

- **`ExternalDocumentUploadDialog`**: `open: boolean`, `onClose: () => void`, `onCreated: (document: DsExternalDocument) => void`

**Hooks used:** `useState`×5, `useDocusignStore` (store/docusign/docusignStore.ts), `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `ExternalDocumentUploadDialog` | component | `ExternalDocumentUploadDialog({ open, onClose, onCreated }: ExternalDocumentUploadDialogP…)` | 28 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/ui/dialog.tsx` — `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`
  - `components/ui/button.tsx` — `Button`
  - `components/ui/label.tsx` — `Label`
  - `components/ui/textarea.tsx` — `Textarea`
  - `lib/docusign/external-api.ts` — `DsExternalDocument`, `(types only)`
  - `lib/docusign/external-api.ts` — `createExternalDocument`, `createExternalDocumentBundle`
  - `store/docusign/docusignStore.ts` — `useDocusignStore`
  - `lib/docusign/access.ts` — `isDocusignAdminUser`, `senderRoleLabel`
  - `components/dashboard/docusign/shared/editorTokens.ts` — `BTN_PRIMARY`, `BTN_SECONDARY`, `HEADING`, `LABEL_MUTED`, `SUBTITLE`, `TEXTAREA`
  - `components/dashboard/docusign/shared/FolderSelect.tsx` — `FolderSelect`
  - `components/dashboard/docusign/shared/PdfFilesPicker.tsx` — `PdfFilesPicker`, `pdfItemsProblem`, `uploadPdfItems`, `PdfItem`
- **Packages:**
  - `react` — `useEffect`, `useState`
  - `sonner` — `toast`
  - `lucide-react` — `Loader2`

## Used by

- `components/dashboard/docusign/DocusignPage.tsx`
