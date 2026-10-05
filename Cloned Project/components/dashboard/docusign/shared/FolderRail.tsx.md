# `components/dashboard/docusign/shared/FolderRail.tsx`

> React component `FolderRail`.

**Kind:** React component · **Lines:** 123 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Button`×2 (components/ui/button.tsx), `DropdownMenuItem`×2 (components/ui/dropdown-menu.tsx), `Loader2` (lucide-react), `FolderPlus` (lucide-react), `Globe` (lucide-react), `Folder` (lucide-react), `DropdownMenu` (components/ui/dropdown-menu.tsx), `DropdownMenuTrigger` (components/ui/dropdown-menu.tsx), `MoreHorizontal` (lucide-react), `DropdownMenuContent` (components/ui/dropdown-menu.tsx), `Pencil` (lucide-react), `DropdownMenuSeparator` (components/ui/dropdown-menu.tsx), `Trash2` (lucide-react)

### Props

- **`FolderRail`**: `folders: DsFolder[]`, `scope: "internal" | "external"`, `unfiledCount: number`, `maxFolders: number`, `isLoading: boolean`, `selected: FolderFilter | undefined`, `onSelect: (next: FolderFilter | undefined) => void`, `onCreate: () => void`, `onRename: (folder: DsFolder) => void`, `onDelete: (folder: DsFolder) => void`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `FolderRail` | component | `FolderRail({ folders, scope, unfiledCount, maxFolders, isLoading, sele…)` | 34 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/ui/button.tsx` — `Button`
  - `components/ui/dropdown-menu.tsx` — `DropdownMenu`, `DropdownMenuContent`, `DropdownMenuItem`, `DropdownMenuSeparator`, `DropdownMenuTrigger`
  - `lib/utils.ts` — `cn`
  - `lib/docusign/types.ts` — `DsFolder`, `FolderFilter`, `(types only)`
- **Packages:**
  - `lucide-react` — `Folder`, `FolderPlus`, `Globe`, `MoreHorizontal`, `Pencil`, `Trash2`, …

## Used by

- `components/dashboard/docusign/external/ExternalSignaturesList.tsx`
- `components/dashboard/docusign/internal/AgreementsView.tsx`
