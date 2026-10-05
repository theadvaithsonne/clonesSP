# `components/dashboard/docusign/external/ExternalSignaturesList.tsx`

> React component `ExternalSignaturesList`.

**Kind:** React component · **Lines:** 472 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Button`×3 (components/ui/button.tsx), `Checkbox`×2 (components/ui/checkbox.tsx), `Folder`×2 (lucide-react), `FolderNameDialog`×2 (components/dashboard/docusign/shared/FolderNameDialog.tsx), `FolderRail` (components/dashboard/docusign/shared/FolderRail.tsx), `Mail` (lucide-react), `Plus` (lucide-react), `FolderInput` (lucide-react), `X` (lucide-react), `ShowRecipientsSwitch` (components/dashboard/docusign/shared/DocumentRecipients.tsx), `Avatar` (components/ui/data-table/cells.tsx), `StatusBadge` (components/dashboard/docusign/shared/StatusBadge.tsx), `Download` (lucide-react), `RecipientsToggle` (components/dashboard/docusign/shared/DocumentRecipients.tsx), `RecipientsList` (components/dashboard/docusign/shared/DocumentRecipients.tsx), `SimplePagination` (components/dashboard/docusign/shared/SimplePagination.tsx), `MoveToFolderDialog` (components/dashboard/docusign/shared/MoveToFolderDialog.tsx), `AlertDialog` (components/ui/alert-dialog.tsx), `AlertDialogContent` (components/ui/alert-dialog.tsx), `AlertDialogHeader` (components/ui/alert-dialog.tsx), `AlertDialogTitle` (components/ui/alert-dialog.tsx), `AlertDialogDescription` (components/ui/alert-dialog.tsx), `AlertDialogFooter` (components/ui/alert-dialog.tsx), `AlertDialogCancel` (components/ui/alert-dialog.tsx), `AlertDialogAction` (components/ui/alert-dialog.tsx), `Loader2` (lucide-react)

### Props

- **`ExternalSignaturesList`**: `onOpen: (doc: DsExternalDocument) => void`, `onNew: () => void`

**Hooks used:** `useState`×8, `useEffect`×3, `useRef`×2, `useDocusignStore` (store/docusign/docusignStore.ts), `useRecipientToggles` (components/dashboard/docusign/shared/DocumentRecipients.tsx), `useMemo`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `ExternalSignaturesList` | component | `ExternalSignaturesList({ onOpen, onNew }: ExternalSignaturesListProps)` | 62 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `store/docusign/docusignStore.ts` — `useDocusignStore`
  - `lib/docusign/access.ts` — `isDocusignAdminUser`
  - `components/dashboard/docusign/shared/StatusBadge.tsx` — `StatusBadge`
  - `components/dashboard/docusign/shared/DocumentRecipients.tsx` — `RecipientsList`, `RecipientsToggle`, `ShowRecipientsSwitch`, `useRecipientToggles`
  - `components/dashboard/docusign/shared/SimplePagination.tsx` — `SimplePagination`, `paginationRangeLabel`
  - `components/dashboard/docusign/shared/FolderRail.tsx` — `FolderRail`
  - `components/dashboard/docusign/shared/FolderNameDialog.tsx` — `FolderNameDialog`
  - `components/dashboard/docusign/shared/MoveToFolderDialog.tsx` — `MoveToFolderDialog`
  - `components/ui/button.tsx` — `Button`
  - `components/ui/checkbox.tsx` — `Checkbox`
  - `components/ui/alert-dialog.tsx` — `AlertDialog`, `AlertDialogAction`, `AlertDialogCancel`, `AlertDialogContent`, `AlertDialogDescription`, `AlertDialogFooter`, `AlertDialogHeader`, `AlertDialogTitle`
  - `lib/docusign/types.ts` — `DsFolder`, `FolderFilter`
  - `lib/docusign/external-api.ts` — `DsExternalDocument`, `moveExternalDocuments`
  - `lib/docusign/shared-api.ts` — `createFolder`, `renameFolder`, `deleteFolder`
  - `components/ui/data-table/cells.tsx` — `Avatar`
  - `components/dashboard/docusign/shared/listFormat.ts` — `formatMailTimestamp`, `isUnreadDocument`
  - `store/docusign/types.ts` — `ExternalStats`, `(types only)`
  - `lib/utils.ts` — `cn`
- **Packages:**
  - `react` — `useEffect`, `useMemo`, `useRef`, `useState`
  - `sonner` — `toast`
  - `lucide-react` — `Mail`, `Loader2`, `Plus`, `Download`, `Folder`, `FolderInput`, …

## Used by

- `components/dashboard/docusign/DocusignPage.tsx`
