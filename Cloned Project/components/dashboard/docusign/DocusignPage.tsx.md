# `components/dashboard/docusign/DocusignPage.tsx`

> React component `DocusignPage`.

**Kind:** React component · **Lines:** 375 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Lock` (lucide-react), `Input` (components/ui/input.tsx), `Button` (components/ui/button.tsx), `DocusignPasscodeGate` (local), `Loader2` (lucide-react), `FileSignature` (lucide-react), `FieldEditorView` (components/dashboard/docusign/internal/FieldEditorView.tsx), `SigningView` (components/dashboard/docusign/internal/SigningView.tsx), `ExternalFieldEditorView` (components/dashboard/docusign/external/ExternalFieldEditorView.tsx), `DocusignDashboardView` (components/dashboard/docusign/DocusignDashboardView.tsx), `DocumentsList` (components/dashboard/docusign/internal/DocumentsList.tsx), `AgreementsView` (components/dashboard/docusign/internal/AgreementsView.tsx), `ExternalSignaturesList` (components/dashboard/docusign/external/ExternalSignaturesList.tsx), `TemplatesList` (components/dashboard/docusign/shared/TemplatesList.tsx), `AdminPanel` (components/dashboard/docusign/shared/AdminPanel.tsx), `DocumentUploadDialog` (components/dashboard/docusign/internal/DocumentUploadDialog.tsx), `ExternalDocumentUploadDialog` (components/dashboard/docusign/external/ExternalDocumentUploadDialog.tsx), `DocusignErrorBoundary` (components/dashboard/docusign/shared/DocusignErrorBoundary.tsx), `DocusignPageInner` (local)

### Props

- **`DocusignPage`**: `initialView?: { mode: "sign" | "edit" | "external-edit"; documentId: …`

**Hooks used:** `useState`×6, `useEffect`×2, `useDocusignStore` (store/docusign/docusignStore.ts), `useRef`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (DocusignPage)` | component | `DocusignPage(props: DocusignPageProps = {})` | 368 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/ui/button.tsx` — `Button`
  - `components/ui/input.tsx` — `Input`
  - `store/docusign/docusignStore.ts` — `useDocusignStore`
  - `components/dashboard/docusign/internal/DocumentsList.tsx` — `DocumentsList`
  - `components/dashboard/docusign/internal/DocumentUploadDialog.tsx` — `DocumentUploadDialog`
  - `components/dashboard/docusign/internal/FieldEditorView.tsx` — `FieldEditorView`
  - `components/dashboard/docusign/internal/SigningView.tsx` — `SigningView`
  - `components/dashboard/docusign/shared/AdminPanel.tsx` — `AdminPanel`
  - `components/dashboard/docusign/shared/TemplatesList.tsx` — `TemplatesList`
  - `components/dashboard/docusign/internal/AgreementsView.tsx` — `AgreementsView`
  - `components/dashboard/docusign/external/ExternalSignaturesList.tsx` — `ExternalSignaturesList`
  - `components/dashboard/docusign/external/ExternalFieldEditorView.tsx` — `ExternalFieldEditorView`
  - `components/dashboard/docusign/external/ExternalDocumentUploadDialog.tsx` — `ExternalDocumentUploadDialog`
  - `components/dashboard/docusign/DocusignDashboardView.tsx` — `DocusignDashboardView`
  - `components/dashboard/docusign/shared/DocusignErrorBoundary.tsx` — `DocusignErrorBoundary`
  - `lib/docusign/types.ts` — `DsTemplate`, `(types only)`
  - `lib/docusign/access.ts` — `canSendDocuments`
  - `components/dashboard/docusign/shared/documentSeed.ts` — `seedFromDocument`, `DocumentSeed`
  - `lib/pdfWorkerSetup.ts` — `preloadPdfWorker`
- **Packages:**
  - `react` — `useEffect`, `useRef`, `useState`
  - `lucide-react` — `Loader2`, `FileSignature`, `Lock`

## Used by

- `app/(dashboard)/layout.tsx`
