# `components/dashboard/docusign/shared/DeclineDialog.tsx`

> React component `DeclineDialog`.

**Kind:** React component · **Lines:** 83 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `AlertDialogAction`×2 (components/ui/alert-dialog.tsx), `AlertDialog` (components/ui/alert-dialog.tsx), `AlertDialogContent` (components/ui/alert-dialog.tsx), `AlertDialogHeader` (components/ui/alert-dialog.tsx), `AlertDialogTitle` (components/ui/alert-dialog.tsx), `AlertDialogDescription` (components/ui/alert-dialog.tsx), `Textarea` (components/ui/textarea.tsx), `AlertDialogFooter` (components/ui/alert-dialog.tsx), `AlertDialogCancel` (components/ui/alert-dialog.tsx), `Loader2` (lucide-react)

### Props

- **`DeclineDialog`**: `open: boolean`, `onOpenChange: (open: boolean) => void`, `pending: boolean`, `onConfirm: (reason: string | undefined) => void`, `needsVerification?: boolean`, `onVerify?: () => void`

**Hooks used:** `useState`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `DeclineDialog` | component | `DeclineDialog({ open, onOpenChange, pending, onConfirm, needsVerification…)` | 35 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/ui/textarea.tsx` — `Textarea`
  - `components/ui/alert-dialog.tsx` — `AlertDialog`, `AlertDialogAction`, `AlertDialogCancel`, `AlertDialogContent`, `AlertDialogDescription`, `AlertDialogFooter`, `AlertDialogHeader`, `AlertDialogTitle`
  - `components/dashboard/docusign/shared/editorTokens.ts` — `TEXTAREA`
- **Packages:**
  - `react` — `useState`
  - `lucide-react` — `Loader2`

## Used by

- `app/(dashboard)/workspace/sign/[token]/PublicSigningView.tsx`
- `components/dashboard/docusign/internal/SigningView.tsx`
