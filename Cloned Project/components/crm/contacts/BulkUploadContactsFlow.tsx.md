# `components/crm/contacts/BulkUploadContactsFlow.tsx`

> React component `BulkUploadContactsFlow`.

**Kind:** React component · **Lines:** 1747 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `TableHead`×16 (components/ui/table.tsx), `TableCell`×16 (components/ui/table.tsx), `Button`×12 (components/ui/button.tsx), `Input`×8 (components/ui/input.tsx), `TableRow`×6 (components/ui/table.tsx), `AlertTriangle`×6 (lucide-react), `Loader2`×5 (lucide-react), `Table`×3 (components/ui/table.tsx), `TableHeader`×3 (components/ui/table.tsx), `TableBody`×3 (components/ui/table.tsx), `Dialog`×3 (components/ui/dialog.tsx), `DialogContent`×3 (components/ui/dialog.tsx), `DialogHeader`×3 (components/ui/dialog.tsx), `DialogTitle`×3 (components/ui/dialog.tsx), `DialogDescription`×3 (components/ui/dialog.tsx), `Label`×3 (components/ui/label.tsx), `Upload`×3 (lucide-react), `CheckCircle`×2 (lucide-react), `Users2`×2 (lucide-react), `Badge`×2 (components/ui/badge.tsx), `XCircle` (lucide-react), `Download` (lucide-react), `RefreshCw` (lucide-react), `Save` (lucide-react), `X` (lucide-react), `Edit3` (lucide-react), `Progress` (components/ui/progress.tsx), `UploadSummary` (local)

### Props

- **`BulkUploadContactsFlow`**: `open: boolean`, `onOpenChange: (open: boolean) => void`, `onUploadComplete?: () => void`

**Hooks used:** `useState`×20, `useCallback`×8, `useRef`×4, `useEffect`×4, `useTheme` (next-themes)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (BulkUploadContactsFlow)` | component | `BulkUploadContactsFlow({ open, onOpenChange, onUploadComplete }: BulkUploadContact…)` | 1747 |

## Interfaces

- **Environment variables (`process.env`):** `NEXT_PUBLIC_FORCE_BULK_UPLOAD_POLLING`, `NEXT_PUBLIC_FORCE_POLLING`
- **Timers / queues:** `setInterval` at L533; `setTimeout` at L1007
- **External hosts mentioned in the code:** `nela-app.s3.us-east-1.amazonaws.com`

## Dependencies

- **Internal:**
  - `components/ui/dialog.tsx` — `Dialog`, `DialogContent`, `DialogDescription`, `DialogHeader`, `DialogTitle`
  - `components/ui/button.tsx` — `Button`
  - `components/ui/input.tsx` — `Input`
  - `components/ui/label.tsx` — `Label`
  - `components/ui/progress.tsx` — `Progress`
  - `components/ui/table.tsx` — `Table`, `TableBody`, `TableCell`, `TableHead`, `TableHeader`, `TableRow`
  - `components/ui/badge.tsx` — `Badge`
  - `utils/api.ts` — `authenticatedFetch`
  - `lib/api-config.ts` — `buildExternalUrl`
- **Packages:**
  - `react` — `useCallback`, `useEffect`, `useRef`, `useState`
  - `lucide-react` — `Upload`, `Download`, `CheckCircle`, `XCircle`, `AlertTriangle`, `Users2`, …
  - `sonner` — `toast`
  - `xlsx`
  - `next-themes` — `useTheme`

## Used by

- `app/(dashboard)/deals/contacts/page.tsx`

## Notes

- Large file (1747 lines) — read it by section; line numbers above point into it.
