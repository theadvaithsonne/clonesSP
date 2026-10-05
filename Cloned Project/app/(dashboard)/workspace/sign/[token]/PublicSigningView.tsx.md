# `app/(dashboard)/workspace/sign/[token]/PublicSigningView.tsx`

> React component `PublicSigningView`.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 690 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Button`×8 (components/ui/button.tsx), `Loader2`×7 (lucide-react), `XCircle`×4 (lucide-react), `CheckCircle2`×2 (lucide-react), `Checkbox`×2 (components/ui/checkbox.tsx), `AlertTriangle` (lucide-react), `BundleSteps` (components/dashboard/docusign/shared/BundleSteps.tsx), `ShieldCheck` (lucide-react), `Input` (components/ui/input.tsx), `Document` (react-pdf), `LazyPdfPage` (components/dashboard/docusign/shared/LazyPdfPage.tsx), `PenLine` (lucide-react), `SignatureCaptureModal` (components/dashboard/docusign/shared/SignatureCaptureModal.tsx), `DeclineDialog` (components/dashboard/docusign/shared/DeclineDialog.tsx)

### Props

- **`PublicSigningView`**: `token: string`

**Hooks used:** `useState`×30, `useRef`×3, `useMemo`×2, `usePageSizes` (components/dashboard/docusign/shared/fieldStyle.ts), `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `PublicSigningView` | component | `PublicSigningView({ token }: { token: string })` | 67 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/pdfWorkerSetup.ts` (side effect)
  - `components/dashboard/docusign/shared/LazyPdfPage.tsx` — `LazyPdfPage`
  - `components/dashboard/docusign/shared/fieldStyle.ts` — `fieldTextStyle`, `signatureStyleKey`, `signatureStyleOf`, `usePageSizes`, `SignatureStyle`
  - `components/dashboard/docusign/shared/SignatureCaptureModal.tsx` — `SignatureCaptureModal`
  - `components/dashboard/docusign/shared/DeclineDialog.tsx` — `DeclineDialog`
  - `components/ui/button.tsx` — `Button`
  - `components/ui/input.tsx` — `Input`
  - `components/ui/checkbox.tsx` — `Checkbox`
  - `lib/docusign/types.ts` — `DsBundleStepper`, `DsField`, `DsVerifyResult`, `(types only)`
  - `components/dashboard/docusign/shared/BundleSteps.tsx` — `BundleSteps`, `isStepOpen`, `nextOpenStep`
  - `lib/docusign/public-api.ts` — `EsignApiError`, `PublicEsignDocument`, `blobToDataUrl`, `confirmEsignOtp`, `declineEsignSign`, `requestEsignOtp`, `submitEsignSign`, `verifyEsignDocument`, … +1
- **Packages:**
  - `react` — `useEffect`, `useMemo`, `useRef`, `useState`
  - `react-pdf` — `Document`
  - `sonner` — `toast`
  - `lucide-react` — `AlertTriangle`, `CheckCircle2`, `Loader2`, `PenLine`, `ShieldCheck`, `XCircle`

## Used by

- `app/(dashboard)/workspace/sign/[token]/page.tsx`
