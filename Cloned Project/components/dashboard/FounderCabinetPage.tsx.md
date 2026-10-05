# `components/dashboard/FounderCabinetPage.tsx`

> React component `FounderCabinetPage`.

**Kind:** React component · **Lines:** 1789 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `DropdownMenuItem`×9 (components/ui/dropdown-menu.tsx), `Button`×8 (components/ui/button.tsx), `Loader2`×5 (lucide-react), `Input`×5 (components/ui/input.tsx), `Dialog`×5 (components/ui/dialog.tsx), `DialogContent`×5 (components/ui/dialog.tsx), `DialogHeader`×5 (components/ui/dialog.tsx), `DialogTitle`×5 (components/ui/dialog.tsx), `Edit`×3 (lucide-react), `DropdownMenu`×2 (components/ui/dropdown-menu.tsx), `DropdownMenuTrigger`×2 (components/ui/dropdown-menu.tsx), `MoreVertical`×2 (lucide-react), `DropdownMenuContent`×2 (components/ui/dropdown-menu.tsx), `Eye`×2 (lucide-react), `Copy`×2 (lucide-react), `Share2`×2 (lucide-react), `FileText`×2 (lucide-react), `CabinetDropOverlay` (components/dashboard/cabinet-upload-ui.tsx), `CabinetUploadProgress` (components/dashboard/cabinet-upload-ui.tsx), `User` (lucide-react), `React` (react), `ChevronRight` (lucide-react), `Search` (lucide-react), `Upload` (lucide-react), `File` (lucide-react), `Folder` (lucide-react), `FileImagePreview` (local), `Star` (lucide-react), `Download` (lucide-react), `ExternalLink` (lucide-react), `Trash2` (lucide-react), `CabinetUploadReviewDialog` (components/dashboard/cabinet-upload-ui.tsx), `Icon` (local), `AlertTriangle` (lucide-react), `AskFileDialog` (components/dashboard/AskFileDialog.tsx), `MediaPreviewModal` (components/ui/media-preview-modal.tsx)

### Props

- **`FounderCabinetPage`**: `onClose?: () => void`

**Hooks used:** `useState`×29, `useEffect`×4, `useAmIFounder` (lib/hooks/useAmIFounder.ts), `useRouter` (next/navigation), `useRef`, `useAffiliateShare` (lib/hooks/useAffiliateShare.ts), `useCabinetUploadGestures` (lib/hooks/useCabinetUploadGestures.ts)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (FounderCabinetPage)` | component | `FounderCabinetPage({ onClose }: FounderCabinetPageProps)` | 245 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/cabinet/organization/files/${fileId}/download?organizationId=${organizationId}` (L188)
  - `GET /backend/cabinet/organization?organizationId=${orgId}` (L376)
  - `GET /backend/cabinet/organization/${cabinetId}?organizationId=${organizationId}` (L401)
  - `POST /backend/cabinet/organization/sub-cabinet?organizationId=${organizationId}` (L432)
  - `POST /backend/cabinet/organization/files/upload?organizationId=${organizationId}` (L485)
  - `PUT /backend/cabinet/organization/files/${fileId}/sharing?organizationId=${organizationId}` (L523)
  - `DELETE /backend/cabinet/organization/files/${fileId}?organizationId=${organizationId}` (L647)
  - `GET /backend/cabinet/organization/files/${file._id}/sharing?organizationId=${organizationId}` (L716)
  - `PUT /backend/cabinet/organization/files/${sharing.fileId}/sharing?organizationId=${organizationId}` (L750)
  - `POST /backend/cabinet/organization/files/${file._id}/transcribe` (L802)
- **Environment variables (`process.env`):** `NEXT_PUBLIC_API_URL`
- **Browser storage / cookies:** `founder_starred_files` (localStorage: get/set), `garage_org_id` (localStorage: get), `garage_tok` (localStorage: get)

## Dependencies

- **Internal:**
  - `lib/api.ts` — `api`
  - `components/ui/button.tsx` — `Button`
  - `components/ui/input.tsx` — `Input`
  - `components/ui/dialog.tsx` — `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`
  - `components/ui/dropdown-menu.tsx` — `DropdownMenu`, `DropdownMenuContent`, `DropdownMenuItem`, `DropdownMenuTrigger`
  - `components/dashboard/AskFileDialog.tsx` — `AskFileDialog`
  - `lib/utils.ts` — `cn`
  - `lib/askSupported.ts` — `isAskSupported`
  - `components/ui/media-preview-modal.tsx` — `MediaPreviewModal`
  - `lib/hooks/useAmIFounder.ts` — `useAmIFounder`
  - `lib/hooks/useAffiliateShare.ts` — `useAffiliateShare`
  - `lib/hooks/useCabinetUploadGestures.ts` — `useCabinetUploadGestures`, `UploadedCabinetFile`
  - `lib/clipboard-files.ts` — `renamePickedFile`, `toPickedFiles`, `PickedFile`
  - `components/dashboard/cabinet-upload-ui.tsx` — `CabinetDropOverlay`, `CabinetUploadProgress`, `CabinetUploadReviewDialog`, `CabinetShareAccess`
- **Packages:**
  - `react` — `useEffect`, `useState`, `useRef`
  - `next` — `useRouter`
  - `sonner` — `toast`
  - `lucide-react` — `Upload`, `Search`, `MoreVertical`, `Folder`, `File`, `Download`, …

## Used by

- `app/(dashboard)/layout.tsx`

## Notes

- Large file (1789 lines) — read it by section; line numbers above point into it.
