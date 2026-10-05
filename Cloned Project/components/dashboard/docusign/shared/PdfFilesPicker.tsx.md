# `components/dashboard/docusign/shared/PdfFilesPicker.tsx`

> React component `PdfFilesPicker`.

**Kind:** React component · **Lines:** 147 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `FileText` (lucide-react), `X` (lucide-react), `UploadCloud` (lucide-react)

### Props

- **`PdfFilesPicker`**: `items: PdfItem[]`, `onChange: (items: PdfItem[]) => void`, `disabled?: boolean`

**Hooks used:** `useRef`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `PdfItem` | interface |  | 14 |
| `looksLikePdf` | function | `async looksLikePdf(f: File): Promise<boolean>` | 25 |
| `pdfItemsProblem` | function | `async pdfItemsProblem(items: PdfItem[]): Promise<string \| null>` | 32 |
| `uploadPdfItems` | function | `async uploadPdfItems(items: PdfItem[], onProgress?: (done: number, total: number) => void)` | 45 |
| `PdfFilesPicker` | component | `PdfFilesPicker({ items, onChange, disabled }: PdfFilesPickerProps)` | 63 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/docusign/client.ts` — `MAX_PDF_BYTES`, `sha256Hex`, `uploadDocusignFile`
  - `lib/docusign/types.ts` — `MAX_BUNDLE_DOCUMENTS`
  - `components/dashboard/docusign/shared/editorTokens.ts` — `INPUT`, `LABEL_MUTED`
- **Packages:**
  - `react` — `useRef`
  - `sonner` — `toast`
  - `lucide-react` — `FileText`, `UploadCloud`, `X`

## Used by

- `components/dashboard/docusign/external/ExternalDocumentUploadDialog.tsx`
- `components/dashboard/docusign/internal/DocumentUploadDialog.tsx`
