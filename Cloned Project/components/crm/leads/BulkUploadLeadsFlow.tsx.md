# `components/crm/leads/BulkUploadLeadsFlow.tsx`

> React component `BulkUploadLeadsFlow`.

**Kind:** React component · **Lines:** 2477 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `TableHead`×41 (components/ui/table.tsx), `TableCell`×41 (components/ui/table.tsx), `Input`×25 (components/ui/input.tsx), `Button`×15 (components/ui/button.tsx), `TableRow`×10 (components/ui/table.tsx), `Label`×6 (components/ui/label.tsx), `Table`×5 (components/ui/table.tsx), `TableHeader`×5 (components/ui/table.tsx), `TableBody`×5 (components/ui/table.tsx), `Loader2`×4 (lucide-react), `Badge`×3 (components/ui/badge.tsx), `CheckCircle`×2 (lucide-react), `Users2`×2 (lucide-react), `Upload`×2 (lucide-react), `AlertTriangle`×2 (lucide-react), `Edit3`×2 (lucide-react), `XCircle` (lucide-react), `Download` (lucide-react), `Link` (next/link), `ArrowLeft` (lucide-react), `FileText` (lucide-react), `DownloadTemplateButton` (local), `RefreshCw` (lucide-react), `Save` (lucide-react), `X` (lucide-react), `Progress` (components/ui/progress.tsx), `Dialog` (components/ui/dialog.tsx), `DialogContent` (components/ui/dialog.tsx), `DialogHeader` (components/ui/dialog.tsx), `DialogTitle` (components/ui/dialog.tsx), `DialogDescription` (components/ui/dialog.tsx), `UploadSummary` (local)

### Props

- **`BulkUploadLeadsFlow`**: `mode?: "page" | "dialog"`, `onClose?: () => void`, `onUploadComplete?: () => void`

**Hooks used:** `useState`×25, `useCallback`×9, `useEffect`×7, `useRef`×4, `useRouter` (next/navigation), `useMemo`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (BulkUploadLeadsFlow)` | component | `BulkUploadLeadsFlow({ mode = "page", onClose, onUploadComplete, }: BulkUploadLe…)` | 2475 |

## Interfaces

- **Environment variables (`process.env`):** `NEXT_PUBLIC_FORCE_BULK_UPLOAD_POLLING`, `NEXT_PUBLIC_FORCE_POLLING`
- **Timers / queues:** `setInterval` at L615; `setTimeout` at L1230

## Dependencies

- **Internal:**
  - `components/ui/button.tsx` — `Button`
  - `components/ui/input.tsx` — `Input`
  - `components/ui/label.tsx` — `Label`
  - `components/ui/progress.tsx` — `Progress`
  - `components/ui/badge.tsx` — `Badge`
  - `components/ui/dialog.tsx` — `Dialog`, `DialogContent`, `DialogDescription`, `DialogHeader`, `DialogTitle`
  - `components/ui/table.tsx` — `Table`, `TableBody`, `TableCell`, `TableHead`, `TableHeader`, `TableRow`
  - `utils/api.ts` — `authenticatedFetch`
  - `lib/api-config.ts` — `buildExternalUrl`
- **Packages:**
  - `react` — `useState`, `useRef`, `useEffect`, `useCallback`, `useMemo`
  - `next` — `useRouter`
  - `lucide-react` — `Upload`, `Download`, `FileText`, `CheckCircle`, `XCircle`, `AlertTriangle`, …
  - `sonner` — `toast`
  - `xlsx`
  - `country-state-city` — `Country`, `State`

## Used by

- `app/(dashboard)/deals/leads/bulk-upload/page.tsx`
- `app/(dashboard)/deals/leads/page.tsx`

## Notes

- Large file (2477 lines) — read it by section; line numbers above point into it.
