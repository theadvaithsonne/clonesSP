# `components/dashboard/FloorCabinetPage.tsx`

> React component `FloorCabinetPage`.

**Kind:** React component · **Lines:** 1103 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Button`×11 (components/ui/button.tsx), `DropdownMenuItem`×7 (components/ui/dropdown-menu.tsx), `Input`×4 (components/ui/input.tsx), `Folder`×3 (lucide-react), `Edit`×3 (lucide-react), `Users`×2 (lucide-react), `ChevronRight`×2 (lucide-react), `Dialog`×2 (components/ui/dialog.tsx), `FolderPlus`×2 (lucide-react), `DialogContent`×2 (components/ui/dialog.tsx), `DialogHeader`×2 (components/ui/dialog.tsx), `DialogTitle`×2 (components/ui/dialog.tsx), `Upload`×2 (lucide-react), `Calendar`×2 (lucide-react), `Clock`×2 (lucide-react), `ExternalLink`×2 (lucide-react), `Eye`×2 (lucide-react), `CabinetDropOverlay` (components/dashboard/cabinet-upload-ui.tsx), `CabinetUploadProgress` (components/dashboard/cabinet-upload-ui.tsx), `Search` (lucide-react), `DialogTrigger` (components/ui/dialog.tsx), `FileThumbnail` (local), `File` (lucide-react), `DropdownMenu` (components/ui/dropdown-menu.tsx), `DropdownMenuTrigger` (components/ui/dropdown-menu.tsx), `MoreVertical` (lucide-react), `DropdownMenuContent` (components/ui/dropdown-menu.tsx), `Download` (lucide-react), `Copy` (lucide-react), `Trash2` (lucide-react), `AskFileDialog` (components/dashboard/AskFileDialog.tsx), `CabinetUploadReviewDialog` (components/dashboard/cabinet-upload-ui.tsx), `MediaPreviewModal` (components/ui/media-preview-modal.tsx)

### Props

- **`FloorCabinetPage`**: `floorId: string`, `floorName: string`, `onClose: () => void`

**Hooks used:** `useState`×20, `useEffect`×2, `useAffiliateShare` (lib/hooks/useAffiliateShare.ts), `useCabinetUploadGestures` (lib/hooks/useCabinetUploadGestures.ts)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (FloorCabinetPage)` | component | `FloorCabinetPage({ floorId, floorName, onClose, }: FloorCabinetPageProps)` | 96 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/cabinet/floor/${floorId}?organizationId=${orgId}` (L165)
  - `GET /backend/cabinet/${cabinetId}?organizationId=${organizationId}` (L197)
  - `POST /backend/cabinet/floor/${floorId}/sub-cabinet?organizationId=${organizationId}` (L228)
  - `POST /backend/cabinet/floor/${floorId}/files/upload?organizationId=${organizationId}` (L271)
  - `GET /backend/cabinet/files/${fileId}/download?organizationId=${organizationId}` (L365)
  - `DELETE /backend/cabinet/files/${fileId}?organizationId=${organizationId}` (L502)
- **Environment variables (`process.env`):** `NEXT_PUBLIC_API_URL`
- **Browser storage / cookies:** `garage_org_id` (localStorage: get), `garage_tok` (localStorage: get)

## Dependencies

- **Internal:**
  - `lib/api.ts` — `api`
  - `components/ui/button.tsx` — `Button`
  - `components/ui/input.tsx` — `Input`
  - `components/ui/dialog.tsx` — `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogTrigger`
  - `components/ui/dropdown-menu.tsx` — `DropdownMenu`, `DropdownMenuContent`, `DropdownMenuItem`, `DropdownMenuTrigger`
  - `components/dashboard/AskFileDialog.tsx` — `AskFileDialog`
  - `lib/utils.ts` — `cn`
  - `lib/askSupported.ts` — `isAskSupported`
  - `components/ui/media-preview-modal.tsx` — `MediaPreviewModal`
  - `lib/hooks/useAffiliateShare.ts` — `useAffiliateShare`
  - `lib/hooks/useCabinetUploadGestures.ts` — `useCabinetUploadGestures`
  - `lib/clipboard-files.ts` — `toPickedFiles`, `PickedFile`
  - `components/dashboard/cabinet-upload-ui.tsx` — `CabinetDropOverlay`, `CabinetUploadProgress`, `CabinetUploadReviewDialog`
- **Packages:**
  - `react` — `useEffect`, `useState`
  - `sonner` — `toast`
  - `lucide-react` — `FolderPlus`, `Upload`, `Search`, `MoreVertical`, `Folder`, `File`, …
  - `js-cookie`

## Used by

No other file imports this one and it has no automatic entry point — it appears unused (or is loaded dynamically by a path the import graph cannot see).
