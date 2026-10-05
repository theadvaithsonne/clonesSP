# `components/dashboard/CabinetPage.tsx`

> React component `CabinetPage`.

**Kind:** React component · **Lines:** 3017 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Button`×10 (components/ui/button.tsx), `Dialog`×4 (components/ui/dialog.tsx), `DialogContent`×4 (components/ui/dialog.tsx), `DialogHeader`×4 (components/ui/dialog.tsx), `DialogTitle`×4 (components/ui/dialog.tsx), `Input`×4 (components/ui/input.tsx), `Download`×4 (lucide-react), `Folder`×4 (lucide-react), `FileText`×3 (lucide-react), `Share2`×3 (lucide-react), `Star`×3 (lucide-react), `DropdownMenuItem`×3 (components/ui/dropdown-menu.tsx), `Users`×3 (lucide-react), `ChevronRight`×2 (lucide-react), `Link`×2 (lucide-react), `HardDrive`×2 (lucide-react), `FileSpreadsheet` (lucide-react), `Presentation` (lucide-react), `Clock` (lucide-react), `CabinetDropOverlay` (components/dashboard/cabinet-upload-ui.tsx), `CabinetUploadProgress` (components/dashboard/cabinet-upload-ui.tsx), `Icon` (local), `CabinetUploadReviewDialog` (components/dashboard/cabinet-upload-ui.tsx), `Eye` (lucide-react), `DropdownMenu` (components/ui/dropdown-menu.tsx), `DropdownMenuTrigger` (components/ui/dropdown-menu.tsx), `MoreVertical` (lucide-react), `DropdownMenuContent` (components/ui/dropdown-menu.tsx), `Globe` (lucide-react), `Edit` (lucide-react), `File` (lucide-react), `Search` (lucide-react), `CheckCircle` (lucide-react), `Trash2` (lucide-react), `Copy` (lucide-react), `AskFileDialog` (components/dashboard/AskFileDialog.tsx), `MediaPreviewModal` (components/ui/media-preview-modal.tsx), `CreateDocumentDialog` (components/dashboard/CreateDocumentDialog.tsx), `DocumentEditorOverlay` (components/dashboard/DocumentEditorOverlay.tsx)

**Hooks used:** `useState`×52, `useEffect`×10, `useRef`×5, `useAffiliateShare` (lib/hooks/useAffiliateShare.ts), `useRouter` (next/navigation), `useCabinetUploadGestures` (lib/hooks/useCabinetUploadGestures.ts)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (CabinetPage)` | component | `CabinetPage()` | 179 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/cabinet?organizationId=${orgId}${filterQuery}` (L457)
  - `GET /backend/cabinet/default?organizationId=${orgId}${filterQuery}` (L475)
  - `GET /backend/cabinet/documents?organizationId=${orgId}` (L534)
  - `GET /backend/cabinet/shared/with-me?organizationId=${organizationId}` (L587)
  - `GET /backend/cabinet/users/members?organizationId=${organizationId}` (L604)
  - `GET /backend/cabinet/documents/${itemId}?organizationId=${organizationId}` (L623)
  - `GET /backend/cabinet/share/${itemId}/${itemType}?organizationId=${organizationId}` (L638)
  - `GET /backend/cabinet/${cabinetId}?organizationId=${organizationId}${filterQuery}` (L669)
  - `POST /backend/cabinet?organizationId=${organizationId}` (L720)
  - `POST /backend/cabinet/files/upload?organizationId=${organizationId}` (L821)
  - `GET /backend/cabinet/files/${fileId}/download?organizationId=${organizationId}` (L1087)
  - `GET /backend/cabinet/shared/files/${fileId}/download?organizationId=${organizationId}` (L1102)
  - `POST /backend/cabinet/documents/from-file?organizationId=${organizationId}` (L1240)
  - `DELETE /backend/cabinet/files/${fileId}?organizationId=${organizationId}` (L1383)
  - `DELETE /backend/cabinet/documents/${documentId}?organizationId=${organizationId}` (L1405)
  - `DELETE /backend/cabinet/${cabinetId}` (L1426)
  - `POST /backend/cabinet/documents/${itemId}/collaborators?organizationId=${organizationId}` (L1577)
  - `POST /backend/cabinet/share?organizationId=${organizationId}` (L1590)
  - `DELETE /backend/cabinet/documents/${selectedItemForShare.id}/collaborators/${shareId}?organizationId=${organizationId}` (L1614)
  - `DELETE /backend/cabinet/share/${shareId}?organizationId=${organizationId}` (L1624)
  - `PUT /backend/cabinet/share/${shareId}?organizationId=${organizationId}` (L1648)
  - `GET /backend/cabinet/shared/cabinets/${cabinetId}?organizationId=${organizationId}` (L1700)
  - `GET /backend/cabinet/files/${fileId}/share-links?organizationId=${organizationId}` (L1780)
  - `POST /backend/cabinet/files/${selectedFileForLink.id}/share-link?organizationId=${organizationId}` (L1820)
- **Environment variables (`process.env`):** `NEXT_PUBLIC_API_URL`
- **Browser storage / cookies:** `cabinet_starred_files` (localStorage: get/set), `garage_user_id` (localStorage: get), `garage_user_name` (localStorage: get), `garage_user_email` (localStorage: get), `garage_org_id` (localStorage: get), `garage_tok` (localStorage: get)

## Dependencies

- **Internal:**
  - `lib/api.ts` — `api`, `API_URL`
  - `components/ui/button.tsx` — `Button`
  - `components/ui/input.tsx` — `Input`
  - `components/ui/dialog.tsx` — `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogTrigger`
  - `components/ui/dropdown-menu.tsx` — `DropdownMenu`, `DropdownMenuContent`, `DropdownMenuItem`, `DropdownMenuTrigger`
  - `lib/utils.ts` — `cn`
  - `lib/affiliate-share.ts` — `withAffiliateRef`
  - `lib/hooks/useAffiliateShare.ts` — `useAffiliateShare`
  - `lib/hooks/useCabinetUploadGestures.ts` — `useCabinetUploadGestures`, `UploadTarget`
  - `lib/clipboard-files.ts` — `toPickedFiles`, `PickedFile`
  - `components/dashboard/cabinet-upload-ui.tsx` — `CabinetDropOverlay`, `CabinetUploadProgress`, `CabinetUploadReviewDialog`
  - `components/dashboard/AskFileDialog.tsx` — `AskFileDialog`
  - `lib/askSupported.ts` — `isAskSupported`
  - `components/ui/media-preview-modal.tsx` — `MediaPreviewModal`
  - `components/dashboard/CreateDocumentDialog.tsx` — `CreateDocumentDialog (default)`
  - `components/dashboard/DocumentEditorOverlay.tsx` — `DocumentEditorOverlay`
- **Packages:**
  - `react` — `useEffect`, `useMemo`, `useState`, `useRef`
  - `sonner` — `toast`
  - `lucide-react` — `FolderPlus`, `Upload`, `Search`, `MoreVertical`, `Folder`, `File`, …
  - `next` — `useRouter`

## Used by

- `app/(dashboard)/layout.tsx`

## Notes

- Large file (3017 lines) — read it by section; line numbers above point into it.
