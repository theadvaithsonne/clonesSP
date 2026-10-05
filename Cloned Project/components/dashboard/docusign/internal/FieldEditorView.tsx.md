# `components/dashboard/docusign/internal/FieldEditorView.tsx`

> React component `FieldEditorView`.

**Kind:** React component · **Lines:** 1360 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Button`×12 (components/ui/button.tsx), `Loader2`×9 (lucide-react), `Copy`×4 (lucide-react), `StatusBadge`×2 (components/dashboard/docusign/shared/StatusBadge.tsx), `PdfPagePlaceholders`×2 (components/dashboard/docusign/shared/PdfPagePlaceholders.tsx), `ArrowLeft` (lucide-react), `Save` (lucide-react), `Send` (lucide-react), `RefreshCw` (lucide-react), `BundleBar` (components/dashboard/docusign/shared/BundleBar.tsx), `Document` (react-pdf), `LazyPdfPage` (components/dashboard/docusign/shared/LazyPdfPage.tsx), `PlacedField` (components/dashboard/docusign/shared/PlacedField.tsx), `FieldStylePanel` (components/dashboard/docusign/shared/FieldStylePanel.tsx), `RecipientsPanel` (components/dashboard/docusign/internal/RecipientsPanel.tsx), `ShieldCheck` (lucide-react), `FileBadge` (lucide-react), `Download` (lucide-react), `Badge` (components/ui/badge.tsx), `ChevronDown` (lucide-react), `ChevronRight` (lucide-react), `Archive` (lucide-react), `CopiesProgressPanel` (components/dashboard/docusign/shared/CopiesProgressPanel.tsx), `AuditTrailView` (components/dashboard/docusign/shared/AuditTrailView.tsx), `Dialog` (components/ui/dialog.tsx), `DialogContent` (components/ui/dialog.tsx), `DialogHeader` (components/ui/dialog.tsx), `DialogTitle` (components/ui/dialog.tsx), `DialogDescription` (components/ui/dialog.tsx), `Checkbox` (components/ui/checkbox.tsx), `DialogFooter` (components/ui/dialog.tsx), `AlertDialog` (components/ui/alert-dialog.tsx), `AlertDialogContent` (components/ui/alert-dialog.tsx), `AlertDialogHeader` (components/ui/alert-dialog.tsx), `AlertDialogTitle` (components/ui/alert-dialog.tsx), `AlertDialogDescription` (components/ui/alert-dialog.tsx), `AlertDialogFooter` (components/ui/alert-dialog.tsx), `AlertDialogCancel` (components/ui/alert-dialog.tsx), `AlertDialogAction` (components/ui/alert-dialog.tsx)

### Props

- **`FieldEditorView`**: `documentId: string`, `initialTemplateFields?: DsTemplate["fields"]`, `seed?: DocumentSeed`, `onBack: () => void`, `onSent: () => void`, `onSwitchDocument?: (documentId: string) => void`

**Hooks used:** `useState`×44, `useRef`×3, `useEffect`×2, `useDocusignStore` (store/docusign/docusignStore.ts), `usePageSizes` (components/dashboard/docusign/shared/fieldStyle.ts), `useMemo`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `FieldEditorView` | component | `FieldEditorView({ documentId, initialTemplateFields, seed, onBack, onSent, …)` | 170 |

## Interfaces

- **Timers / queues:** `setTimeout` at L747

## Dependencies

- **Internal:**
  - `lib/pdfWorkerSetup.ts` (side effect)
  - `components/dashboard/docusign/shared/LazyPdfPage.tsx` — `LazyPdfPage`
  - `components/dashboard/docusign/shared/PlacedField.tsx` — `PlacedField`
  - `components/dashboard/docusign/shared/FieldStylePanel.tsx` — `FieldStylePanel`
  - `components/dashboard/docusign/shared/fieldStyle.ts` — `fieldTextStyle`, `usePageSizes`
  - `components/dashboard/docusign/shared/recipientRemap.ts` — `remapFieldOwners`, `shortRecipientName`
  - `components/ui/button.tsx` — `Button`
  - `components/ui/badge.tsx` — `Badge`
  - `components/ui/checkbox.tsx` — `Checkbox`
  - `components/ui/dialog.tsx` — `Dialog`, `DialogContent`, `DialogDescription`, `DialogFooter`, `DialogHeader`, `DialogTitle`
  - `components/ui/alert-dialog.tsx` — `AlertDialog`, `AlertDialogAction`, `AlertDialogCancel`, `AlertDialogContent`, `AlertDialogDescription`, `AlertDialogFooter`, `AlertDialogHeader`, `AlertDialogTitle`
  - `components/dashboard/docusign/internal/RecipientsPanel.tsx` — `RecipientsPanel`, `RecipientDraft`
  - `components/dashboard/docusign/shared/recipientConstants.ts` — `RECIPIENT_COLORS`, `MAX_SEPARATE_COPIES`
  - `store/docusign/docusignStore.ts` — `useDocusignStore`
  - `components/dashboard/docusign/shared/StatusBadge.tsx` — `StatusBadge`
  - `components/dashboard/docusign/shared/editorTokens.ts` — `BTN_PRIMARY`, `BTN_SECONDARY`
  - `components/dashboard/docusign/shared/AuditTrailView.tsx` — `AuditTrailView`
  - `components/dashboard/docusign/shared/CopiesProgressPanel.tsx` — `CopiesProgressPanel`
  - `lib/docusign/types.ts` — `DsField`, `DsAuditLogEntry`, `DsDeliveryMode`, `DsVerifyResult`, `DsTemplate`, `(types only)`
  - `lib/docusign/internal-api.ts` — `DsRecipient`, `getDocumentDetail`, `getAuditLogPage`, `getDocumentFileLink`, `downloadEvidencePackage`, `setRecipients as apiSetRecipients`, `setFields as apiSetFields`, `sendDocument as apiSendDocument`, … +9
  - `lib/docusign/types.ts` — `DsBundle`, `(types only)`
  - `components/dashboard/docusign/shared/BundleBar.tsx` — `BundleBar`
  - `lib/docusign/shared-api.ts` — `createTemplate as apiCreateTemplate`
  - `components/dashboard/docusign/shared/documentSeed.ts` — `DocumentSeed`, `(types only)`
  - `components/dashboard/docusign/shared/PdfPagePlaceholders.tsx` — `PdfPagePlaceholders`
- **Packages:**
  - `react` — `useEffect`, `useMemo`, `useRef`, `useState`
  - `react-pdf` — `Document`
  - `sonner` — `toast`
  - `lucide-react` — `ArrowLeft`, `Loader2`, `Send`, `Type`, `PenLine`, `Signature`, …

## Used by

- `components/dashboard/docusign/DocusignPage.tsx`
