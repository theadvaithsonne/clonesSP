# `components/dashboard/cabinet-upload-ui.tsx`

> React components `CabinetDropOverlay`, `CabinetUploadProgress`, `CabinetUploadReviewDialog`.

**Kind:** React component · **Lines:** 574 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Upload`×3 (lucide-react), `Loader2`×2 (lucide-react), `Button`×2 (components/ui/button.tsx), `ImageIcon` (lucide-react), `Film` (lucide-react), `Music` (lucide-react), `FileText` (lucide-react), `FileIcon` (lucide-react), `Dialog` (components/ui/dialog.tsx), `DialogContent` (components/ui/dialog.tsx), `DialogHeader` (components/ui/dialog.tsx), `DialogTitle` (components/ui/dialog.tsx), `Folder` (lucide-react), `FileGlyph` (local), `Pencil` (lucide-react), `X` (lucide-react), `Icon` (local), `AlertTriangle` (lucide-react)

### Props

- **`CabinetDropOverlay`**: `visible: boolean`, `targetName?: string`
- **`CabinetUploadProgress`**: `progress: UploadProgress | null`
- **`CabinetUploadReviewDialog`**: `open: boolean`, `onOpenChange: (open: boolean) => void`, `files: PickedFile[]`, `destination: string`, `onRemove: (index: number) => void`, `onRename?: (index: number, nextName: string) => void`, `onClear: () => void`, `onConfirm: () => void`, `onAddFiles?: (files: File[]) => void`, `uploading: boolean`, `progress: UploadProgress | null`, `recreatesFolders?: boolean`, `shareAccess?: CabinetShareAccess`, `onShareAccessChange?: (access: CabinetShareAccess) => void`, `remainingBytes?: number`, `storageLimit?: number`, `planSlug?: "starter" | "pro" | string`

**Hooks used:** `useMemo`×2, `useEffect`×2, `useState`×2, `useRef`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `CabinetDropOverlay` | component | `CabinetDropOverlay({ visible, targetName, }: { visible: boolean; targetName?: …)` — The chrome every cabinet shows for paste/drop uploads: the drop overlay, the progress pill, and the review dialog that stands between a gesture and the server. | 38 |
| `CabinetUploadProgress` | component | `CabinetUploadProgress({ progress, }: { progress: UploadProgress \| null; })` | 63 |
| `formatBytes` | function | `formatBytes(bytes: number): string` | 84 |
| `CabinetShareAccess` | type | Mirrors the backend's `sharing.access` enum on a cabinet file. | 107 |
| `CabinetUploadReviewDialog` | component | `CabinetUploadReviewDialog({ open, onOpenChange, files, destination, onRemove, onRenam…)` — "Here is what you just pasted/dropped — send it?" | 175 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/ui/dialog.tsx` — `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`
  - `components/ui/button.tsx` — `Button`
  - `lib/utils.ts` — `cn`
  - `lib/clipboard-files.ts` — `PickedFile`, `(types only)`
  - `lib/hooks/useCabinetUploadGestures.ts` — `UploadProgress`, `(types only)`
- **Packages:**
  - `react` — `useEffect`, `useMemo`, `useRef`, `useState`
  - `lucide-react` — `AlertTriangle`, `File as FileIcon`, `FileText`, `Film`, `Folder`, `Globe`, …

## Used by

- `components/dashboard/CabinetPage.tsx`
- `components/dashboard/FloorCabinetPage.tsx`
- `components/dashboard/FounderCabinetPage.tsx`
