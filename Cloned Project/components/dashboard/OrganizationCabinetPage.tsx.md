# `components/dashboard/OrganizationCabinetPage.tsx`

> React component `OrganizationCabinetPage`.

**Kind:** React component · **Lines:** 1105 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `DropdownMenuItem`×8 (components/ui/dropdown-menu.tsx), `Button`×5 (components/ui/button.tsx), `Loader2`×3 (lucide-react), `Edit`×3 (lucide-react), `DropdownMenu`×2 (components/ui/dropdown-menu.tsx), `DropdownMenuTrigger`×2 (components/ui/dropdown-menu.tsx), `MoreVertical`×2 (lucide-react), `DropdownMenuContent`×2 (components/ui/dropdown-menu.tsx), `Eye`×2 (lucide-react), `FileText`×2 (lucide-react), `Dialog`×2 (components/ui/dialog.tsx), `DialogContent`×2 (components/ui/dialog.tsx), `DialogHeader`×2 (components/ui/dialog.tsx), `DialogTitle`×2 (components/ui/dialog.tsx), `User` (lucide-react), `React` (react), `ChevronRight` (lucide-react), `File` (lucide-react), `Folder` (lucide-react), `FileImagePreview` (local), `Star` (lucide-react), `Download` (lucide-react), `ExternalLink` (lucide-react), `Copy` (lucide-react), `Trash2` (lucide-react), `Input` (components/ui/input.tsx), `AskFileDialog` (components/dashboard/AskFileDialog.tsx), `MediaPreviewModal` (components/ui/media-preview-modal.tsx)

### Props

- **`OrganizationCabinetPage`**: `onClose?: () => void`

**Hooks used:** `useState`×19, `useEffect`×3, `useAmIFounder` (lib/hooks/useAmIFounder.ts), `useRef`, `useAffiliateShare` (lib/hooks/useAffiliateShare.ts)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (OrganizationCabinetPage)` | component | `OrganizationCabinetPage({ onClose }: OrganizationCabinetPageProps)` | 178 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/cabinet/organization/files/${fileId}/download?organizationId=${organizationId}` (L121)
  - `GET /backend/cabinet/organization?organizationId=${orgId}` (L275)
  - `GET /backend/cabinet/organization/${cabinetId}?organizationId=${organizationId}` (L311)
  - `DELETE /backend/cabinet/organization/files/${fileId}?organizationId=${organizationId}` (L408)
  - `POST /backend/cabinet/organization/files/${file._id}/transcribe` (L470)
- **Environment variables (`process.env`):** `NEXT_PUBLIC_API_URL`
- **Browser storage / cookies:** `org_starred_files` (localStorage: get/set), `garage_org_id` (localStorage: get), `garage_tok` (localStorage: get)

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
- **Packages:**
  - `react` — `useEffect`, `useState`, `useRef`
  - `sonner` — `toast`
  - `lucide-react` — `Search`, `MoreVertical`, `Folder`, `File`, `Download`, `Trash2`, …

## Used by

- `app/(dashboard)/layout.tsx`
- `app/(dashboard)/workspace/WorkspaceClient.tsx`
