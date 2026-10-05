# `components/dashboard/docusign/shared/SignatureCaptureModal.tsx`

> React component `SignatureCaptureModal`.

**Kind:** React component · **Lines:** 286 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Button`×4 (components/ui/button.tsx), `TabsTrigger`×3 (components/ui/tabs.tsx), `TabsContent`×3 (components/ui/tabs.tsx), `Loader2`×3 (lucide-react), `Dialog` (components/ui/dialog.tsx), `DialogContent` (components/ui/dialog.tsx), `DialogHeader` (components/ui/dialog.tsx), `DialogTitle` (components/ui/dialog.tsx), `Tabs` (components/ui/tabs.tsx), `TabsList` (components/ui/tabs.tsx), `Input` (components/ui/input.tsx), `UploadIcon` (lucide-react)

### Props

- **`SignatureCaptureModal`**: `open: boolean`, `title?: string`, `onClose: () => void`, `onCaptured: (result: { type: "draw" | "type" | "upload"; imageUrl: st…`, `style?: SignatureStyle`, `uploadFn?: (file: Blob | File, filename: string, folder?: string) => …`

**Hooks used:** `useState`×4, `useRef`×2, `useEffect`, `useCallback`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `SignatureCaptureModal` | component | `SignatureCaptureModal({ open, title = "Add your signature", onClose, onCaptured, …)` | 46 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/ui/dialog.tsx` — `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`
  - `components/ui/button.tsx` — `Button`
  - `components/ui/input.tsx` — `Input`
  - `components/ui/tabs.tsx` — `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent`
  - `lib/docusign/client.ts` — `uploadDocusignFile`
  - `components/dashboard/docusign/shared/fieldStyle.ts` — `isLightColor`, `SignatureStyle`
  - `components/dashboard/docusign/shared/downscaleImage.ts` — `downscaleImage`
- **Packages:**
  - `react` — `useCallback`, `useRef`, `useState`, `useEffect`
  - `sonner` — `toast`
  - `lucide-react` — `Loader2`, `Upload as UploadIcon`

## Used by

- `app/(dashboard)/workspace/sign/[token]/PublicSigningView.tsx`
- `components/dashboard/docusign/external/ExternalFieldEditorView.tsx`
- `components/dashboard/docusign/internal/SigningView.tsx`
