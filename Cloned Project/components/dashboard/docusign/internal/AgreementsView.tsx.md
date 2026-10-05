# `components/dashboard/docusign/internal/AgreementsView.tsx`

> React component `AgreementsView`.

**Kind:** React component · **Lines:** 483 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Checkbox`×2 (components/ui/checkbox.tsx), `Folder`×2 (lucide-react), `FolderNameDialog`×2 (components/dashboard/docusign/shared/FolderNameDialog.tsx), `FolderRail` (components/dashboard/docusign/shared/FolderRail.tsx), `Inbox` (lucide-react), `Button` (components/ui/button.tsx), `FolderInput` (lucide-react), `X` (lucide-react), `ShowRecipientsSwitch` (components/dashboard/docusign/shared/DocumentRecipients.tsx), `Avatar` (components/ui/data-table/cells.tsx), `StatusBadge` (components/dashboard/docusign/shared/StatusBadge.tsx), `RecipientsToggle` (components/dashboard/docusign/shared/DocumentRecipients.tsx), `RecipientsList` (components/dashboard/docusign/shared/DocumentRecipients.tsx), `SimplePagination` (components/dashboard/docusign/shared/SimplePagination.tsx), `MoveToFolderDialog` (components/dashboard/docusign/shared/MoveToFolderDialog.tsx), `AlertDialog` (components/ui/alert-dialog.tsx), `AlertDialogContent` (components/ui/alert-dialog.tsx), `AlertDialogHeader` (components/ui/alert-dialog.tsx), `AlertDialogTitle` (components/ui/alert-dialog.tsx), `AlertDialogDescription` (components/ui/alert-dialog.tsx), `AlertDialogFooter` (components/ui/alert-dialog.tsx), `AlertDialogCancel` (components/ui/alert-dialog.tsx), `AlertDialogAction` (components/ui/alert-dialog.tsx), `Loader2` (lucide-react)

### Props

- **`AgreementsView`**: `onOpen: (doc: DsDocument) => void`

**Hooks used:** `useState`×8, `useEffect`×3, `useMemo`×2, `useRef`×2, `useDocusignStore` (store/docusign/docusignStore.ts), `useRecipientToggles` (components/dashboard/docusign/shared/DocumentRecipients.tsx)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `AgreementsView` | component | `AgreementsView({ onOpen }: AgreementsViewProps)` | 78 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `store/docusign/docusignStore.ts` — `useDocusignStore`
  - `components/dashboard/docusign/shared/StatusBadge.tsx` — `StatusBadge`
  - `components/dashboard/docusign/shared/SimplePagination.tsx` — `SimplePagination`, `paginationRangeLabel`
  - `components/dashboard/docusign/shared/listFormat.ts` — `formatMailTimestamp`, `isUnreadDocument`
  - `components/ui/data-table/cells.tsx` — `Avatar`
  - `components/dashboard/docusign/shared/DocumentRecipients.tsx` — `RecipientsList`, `RecipientsToggle`, `ShowRecipientsSwitch`, `useRecipientToggles`
  - `lib/docusign/types.ts` — `DsFolder`, `FolderFilter`
  - `lib/docusign/internal-api.ts` — `DsDocument`, `moveDocuments`
  - `lib/docusign/shared-api.ts` — `createFolder`, `renameFolder`, `deleteFolder`
  - `lib/docusign/access.ts` — `isDocusignAdminUser`
  - `components/dashboard/docusign/shared/FolderRail.tsx` — `FolderRail`
  - `components/dashboard/docusign/shared/FolderNameDialog.tsx` — `FolderNameDialog`
  - `components/dashboard/docusign/shared/MoveToFolderDialog.tsx` — `MoveToFolderDialog`
  - `components/ui/button.tsx` — `Button`
  - `components/ui/checkbox.tsx` — `Checkbox`
  - `components/ui/alert-dialog.tsx` — `AlertDialog`, `AlertDialogAction`, `AlertDialogCancel`, `AlertDialogContent`, `AlertDialogDescription`, `AlertDialogFooter`, `AlertDialogHeader`, `AlertDialogTitle`
  - `lib/utils.ts` — `cn`
- **Packages:**
  - `react` — `useEffect`, `useMemo`, `useRef`, `useState`
  - `sonner` — `toast`
  - `lucide-react` — `Inbox`, `UserCheck`, `Send`, `MailCheck`, `FileEdit`, `Clock`, …

## Used by

- `components/dashboard/docusign/DocusignPage.tsx`
