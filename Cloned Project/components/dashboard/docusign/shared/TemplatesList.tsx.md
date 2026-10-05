# `components/dashboard/docusign/shared/TemplatesList.tsx`

> React component `TemplatesList`.

**Kind:** React component · **Lines:** 240 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Button`×3 (components/ui/button.tsx), `Loader2`×3 (lucide-react), `LayoutTemplate`×2 (lucide-react), `Search` (lucide-react), `Trash2` (lucide-react), `SimplePagination` (components/dashboard/docusign/shared/SimplePagination.tsx), `AlertDialog` (components/ui/alert-dialog.tsx), `AlertDialogContent` (components/ui/alert-dialog.tsx), `AlertDialogHeader` (components/ui/alert-dialog.tsx), `AlertDialogTitle` (components/ui/alert-dialog.tsx), `AlertDialogDescription` (components/ui/alert-dialog.tsx), `AlertDialogFooter` (components/ui/alert-dialog.tsx), `AlertDialogCancel` (components/ui/alert-dialog.tsx), `AlertDialogAction` (components/ui/alert-dialog.tsx)

### Props

- **`TemplatesList`**: `canManage: boolean`, `onUseTemplate: (document: DsDocument, templateFields: DsTemplate["fie…`, `onUseExternalTemplate: (document: DsExternalDocument, templateFields:…`

**Hooks used:** `useState`×9, `useEffect`×2, `useRef`×2

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `TemplatesList` | component | `TemplatesList({ canManage, onUseTemplate, onUseExternalTemplate }: Templa…)` | 36 |

## Interfaces

- **Timers / queues:** `setTimeout` at L52

## Dependencies

- **Internal:**
  - `components/ui/button.tsx` — `Button`
  - `components/ui/alert-dialog.tsx` — `AlertDialog`, `AlertDialogAction`, `AlertDialogCancel`, `AlertDialogContent`, `AlertDialogDescription`, `AlertDialogFooter`, `AlertDialogHeader`, `AlertDialogTitle`
  - `lib/docusign/types.ts` — `DsPagination`, `DsTemplate`
  - `lib/docusign/internal-api.ts` — `DsDocument`
  - `lib/docusign/external-api.ts` — `DsExternalDocument`
  - `lib/docusign/shared-api.ts` — `listTemplates`, `deleteTemplate`, `instantiateTemplate`, `instantiateExternalTemplate`
  - `components/dashboard/docusign/shared/SimplePagination.tsx` — `SimplePagination`, `paginationRangeLabel`
- **Packages:**
  - `react` — `useEffect`, `useRef`, `useState`
  - `sonner` — `toast`
  - `lucide-react` — `LayoutTemplate`, `Loader2`, `Search`, `Trash2`

## Used by

- `components/dashboard/docusign/DocusignPage.tsx`
