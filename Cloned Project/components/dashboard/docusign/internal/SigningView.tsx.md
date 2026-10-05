# `components/dashboard/docusign/internal/SigningView.tsx`

> React component `SigningView`.

**Kind:** React component · **Lines:** 618 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Button`×10 (components/ui/button.tsx), `Loader2`×5 (lucide-react), `ArrowLeft`×2 (lucide-react), `Checkbox`×2 (components/ui/checkbox.tsx), `AlertTriangle` (lucide-react), `FileEdit` (lucide-react), `StatusBadge` (components/dashboard/docusign/shared/StatusBadge.tsx), `XCircle` (lucide-react), `BundleSteps` (components/dashboard/docusign/shared/BundleSteps.tsx), `ShieldCheck` (lucide-react), `Input` (components/ui/input.tsx), `Document` (react-pdf), `LazyPdfPage` (components/dashboard/docusign/shared/LazyPdfPage.tsx), `PenLine` (lucide-react), `SignatureCaptureModal` (components/dashboard/docusign/shared/SignatureCaptureModal.tsx), `DeclineDialog` (components/dashboard/docusign/shared/DeclineDialog.tsx)

### Props

- **`SigningView`**: `documentId: string`, `onBack: () => void`, `onDone: () => void`, `onOpenEditor?: (documentId: string) => void`, `onOpenDocument?: (documentId: string) => void`

**Hooks used:** `useState`×26, `useRef`×3, `useMemo`×3, `useUser` (store/authStore.tsx), `usePageSizes` (components/dashboard/docusign/shared/fieldStyle.ts), `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `SigningView` | component | `SigningView({ documentId, onBack, onDone, onOpenEditor, onOpenDocument …)` | 55 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/pdfWorkerSetup.ts` (side effect)
  - `components/dashboard/docusign/shared/LazyPdfPage.tsx` — `LazyPdfPage`
  - `components/dashboard/docusign/shared/fieldStyle.ts` — `fieldTextStyle`, `signatureStyleKey`, `signatureStyleOf`, `usePageSizes`, `SignatureStyle`
  - `components/ui/button.tsx` — `Button`
  - `components/ui/input.tsx` — `Input`
  - `components/ui/checkbox.tsx` — `Checkbox`
  - `components/dashboard/docusign/shared/SignatureCaptureModal.tsx` — `SignatureCaptureModal`
  - `components/dashboard/docusign/shared/DeclineDialog.tsx` — `DeclineDialog`
  - `components/dashboard/docusign/shared/StatusBadge.tsx` — `StatusBadge`
  - `store/authStore.tsx` — `useUser`
  - `lib/docusign/types.ts` — `DsField`, `DsBundleStepper`
  - `components/dashboard/docusign/shared/BundleSteps.tsx` — `BundleSteps`, `isStepOpen`, `nextOpenStep`
  - `lib/docusign/internal-api.ts` — `DsDocument`, `viewDocumentAsRecipient`, `requestEmailVerification as apiRequestEmailVerification`, `confirmEmailVerification as apiConfirmEmailVerification`, `signDocument as apiSignDocument`, `declineDocument as apiDeclineDocument`
- **Packages:**
  - `react` — `useEffect`, `useMemo`, `useRef`, `useState`
  - `react-pdf` — `Document`
  - `sonner` — `toast`
  - `lucide-react` — `AlertTriangle`, `ArrowLeft`, `FileEdit`, `Loader2`, `PenLine`, `ShieldCheck`, …

## Used by

- `components/dashboard/docusign/DocusignPage.tsx`
