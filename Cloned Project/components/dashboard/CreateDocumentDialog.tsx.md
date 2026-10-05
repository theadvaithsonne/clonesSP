# `components/dashboard/CreateDocumentDialog.tsx`

> React component `CreateDocumentDialog`.

**Kind:** React component · **Lines:** 244 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Button`×2 (components/ui/button.tsx), `Dialog` (components/ui/dialog.tsx), `DialogContent` (components/ui/dialog.tsx), `DialogHeader` (components/ui/dialog.tsx), `DialogTitle` (components/ui/dialog.tsx), `Input` (components/ui/input.tsx), `Loader2` (lucide-react)

### Props

- **`CreateDocumentDialog`**: `open: boolean`, `onOpenChange: (open: boolean) => void`, `organizationId: string`, `cabinetId?: string | null`, `onDocumentCreated?: (documentId: string) => void`

**Hooks used:** `useState`×4, `useRouter` (next/navigation)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (CreateDocumentDialog)` | component | `CreateDocumentDialog({ open, onOpenChange, organizationId, cabinetId, onDocument…)` | 61 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `POST /backend/cabinet/documents?organizationId=${organizationId}` (L90)
- **Timers / queues:** `setTimeout` at L128

## Dependencies

- **Internal:**
  - `components/ui/dialog.tsx` — `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`
  - `components/ui/button.tsx` — `Button`
  - `components/ui/input.tsx` — `Input`
  - `lib/api.ts` — `api`
  - `lib/auth.ts` — `getToken`
  - `lib/utils.ts` — `cn`
- **Packages:**
  - `react` — `useState`
  - `next` — `useRouter`
  - `sonner` — `toast`
  - `lucide-react` — `FileText`, `FileSpreadsheet`, `Presentation`, `Loader2`

## Used by

- `components/dashboard/CabinetPage.tsx`
