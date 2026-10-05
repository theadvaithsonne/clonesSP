# `components/dashboard/docusign/external/ExternalFieldEditorView.tsx`

> React component `ExternalFieldEditorView`.

**Kind:** React component · **Lines:** 1396 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Button`×15 (components/ui/button.tsx), `Loader2`×11 (lucide-react), `Copy`×4 (lucide-react), `Checkbox`×3 (components/ui/checkbox.tsx), `StatusBadge`×2 (components/dashboard/docusign/shared/StatusBadge.tsx), `PdfPagePlaceholders`×2 (components/dashboard/docusign/shared/PdfPagePlaceholders.tsx), `ArrowLeft` (lucide-react), `Save` (lucide-react), `UserCheck` (lucide-react), `Send` (lucide-react), `RefreshCw` (lucide-react), `BundleBar` (components/dashboard/docusign/shared/BundleBar.tsx), `Document` (react-pdf), `LazyPdfPage` (components/dashboard/docusign/shared/LazyPdfPage.tsx), `PenLine` (lucide-react), `PlacedField` (components/dashboard/docusign/shared/PlacedField.tsx), `FieldStylePanel` (components/dashboard/docusign/shared/FieldStylePanel.tsx), `ExternalRecipientsPanel` (components/dashboard/docusign/external/ExternalRecipientsPanel.tsx), `ShieldCheck` (lucide-react), `FileBadge` (lucide-react), `Download` (lucide-react), `Badge` (components/ui/badge.tsx), `ChevronDown` (lucide-react), `ChevronRight` (lucide-react), `Archive` (lucide-react), `CopiesProgressPanel` (components/dashboard/docusign/shared/CopiesProgressPanel.tsx), `AuditTrailView` (components/dashboard/docusign/shared/AuditTrailView.tsx), `SignatureCaptureModal` (components/dashboard/docusign/shared/SignatureCaptureModal.tsx), `Dialog` (components/ui/dialog.tsx), `DialogContent` (components/ui/dialog.tsx), `DialogHeader` (components/ui/dialog.tsx), `DialogTitle` (components/ui/dialog.tsx), `DialogDescription` (components/ui/dialog.tsx), `DialogFooter` (components/ui/dialog.tsx), `AlertDialog` (components/ui/alert-dialog.tsx), `AlertDialogContent` (components/ui/alert-dialog.tsx), `AlertDialogHeader` (components/ui/alert-dialog.tsx), `AlertDialogTitle` (components/ui/alert-dialog.tsx), `AlertDialogDescription` (components/ui/alert-dialog.tsx), `AlertDialogFooter` (components/ui/alert-dialog.tsx), … +2 more

### Props

- **`ExternalFieldEditorView`**: `documentId: string`, `initialTemplateFields?: DsTemplate["fields"]`, `seed?: DocumentSeed`, `onBack: () => void`, `onSent: () => void`, `onSwitchDocument?: (documentId: string) => void`

**Hooks used:** `useState`×49, `useRef`×3, `useEffect`×2, `usePageSizes` (components/dashboard/docusign/shared/fieldStyle.ts), `useMemo`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `ExternalFieldEditorView` | component | `ExternalFieldEditorView({ documentId, initialTemplateFields, seed, onBack, onSent, …)` | 159 |

## Interfaces

- **Timers / queues:** `setTimeout` at L645

## Dependencies

- **Internal:**
  - `lib/pdfWorkerSetup.ts` (side effect)
  - `components/dashboard/docusign/shared/LazyPdfPage.tsx` — `LazyPdfPage`
  - `components/dashboard/docusign/shared/PdfPagePlaceholders.tsx` — `PdfPagePlaceholders`
  - `components/dashboard/docusign/shared/documentSeed.ts` — `DocumentSeed`, `(types only)`
  - `components/dashboard/docusign/shared/PlacedField.tsx` — `PlacedField`
  - `components/dashboard/docusign/shared/FieldStylePanel.tsx` — `FieldStylePanel`
  - `components/dashboard/docusign/shared/fieldStyle.ts` — `fieldTextStyle`, `signatureStyleKey`, `signatureStyleOf`, `usePageSizes`, `SignatureStyle`
  - `components/dashboard/docusign/shared/recipientRemap.ts` — `remapFieldOwners`, `shortRecipientName`
  - `components/ui/button.tsx` — `Button`
  - `components/ui/badge.tsx` — `Badge`
  - `components/ui/checkbox.tsx` — `Checkbox`
  - `components/ui/dialog.tsx` — `Dialog`, `DialogContent`, `DialogDescription`, `DialogFooter`, `DialogHeader`, `DialogTitle`
  - `components/ui/alert-dialog.tsx` — `AlertDialog`, `AlertDialogAction`, `AlertDialogCancel`, `AlertDialogContent`, `AlertDialogDescription`, `AlertDialogFooter`, `AlertDialogHeader`, `AlertDialogTitle`
  - `components/dashboard/docusign/external/ExternalRecipientsPanel.tsx` — `ExternalRecipientsPanel`, `ExternalRecipientDraft`
  - `components/dashboard/docusign/shared/recipientConstants.ts` — `RECIPIENT_COLORS`, `MAX_SEPARATE_COPIES`
  - `components/dashboard/docusign/shared/StatusBadge.tsx` — `StatusBadge`
  - `components/dashboard/docusign/shared/editorTokens.ts` — `BTN_PRIMARY`, `BTN_SECONDARY`
  - `components/dashboard/docusign/shared/AuditTrailView.tsx` — `AuditTrailView`
  - `components/dashboard/docusign/shared/SignatureCaptureModal.tsx` — `SignatureCaptureModal`
  - `components/dashboard/docusign/shared/CopiesProgressPanel.tsx` — `CopiesProgressPanel`
  - `lib/docusign/types.ts` — `DsAuditLogEntry`, `DsVerifyResult`, `DsTemplate`, `DsDeliveryMode`
  - `lib/docusign/external-api.ts` — `DsExternalField`, `DsExternalRecipient`, `getExternalDocumentDetail`, `getExternalAuditLogPage`, `setExternalRecipients as apiSetRecipients`, `setExternalFields as apiSetFields`, `voidExternalDocument as apiVoidDocument`, `fillOnBehalfExternalDocument as apiFillOnBehalf`, … +10
  - `lib/docusign/types.ts` — `DsBundle`, `(types only)`
  - `components/dashboard/docusign/shared/BundleBar.tsx` — `BundleBar`
- **Packages:**
  - `react` — `useEffect`, `useMemo`, `useRef`, `useState`
  - `react-pdf` — `Document`
  - `sonner` — `toast`
  - `lucide-react` — `ArrowLeft`, `Loader2`, `Type`, `PenLine`, `Signature`, `Stamp`, …

## Used by

- `components/dashboard/docusign/DocusignPage.tsx`
