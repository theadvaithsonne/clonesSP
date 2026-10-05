# `components/ui/confirm-dialog.tsx`

> React component `ConfirmDialog`.

**Kind:** UI primitive (shadcn/Radix wrapper) · **Lines:** 83 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Dialog` (components/ui/dialog.tsx), `DialogContent` (components/ui/dialog.tsx), `DialogHeader` (components/ui/dialog.tsx), `DialogTitle` (components/ui/dialog.tsx), `DialogDescription` (components/ui/dialog.tsx), `DialogFooter` (components/ui/dialog.tsx), `Loader2` (lucide-react)

### Props

- **`ConfirmDialog`**: `open: boolean`, `onOpenChange: (v: boolean) => void`, `title: string`, `description?: React.ReactNode`, `confirmLabel?: string`, `cancelLabel?: string`, `danger?: boolean`, `loading?: boolean`, `onConfirm: () => void`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `ConfirmDialog` | component | `ConfirmDialog({ open, onOpenChange, title, description, confirmLabel = "D…)` — Reusable confirmation modal for destructive actions. | 17 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/ui/dialog.tsx` — `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`, `DialogFooter`
- **Packages:**
  - `react`
  - `lucide-react` — `Loader2`

## Used by

- `app/garage-admin/(admin-dashboard)/networkchains/funnels/[id]/page.tsx`
- `app/garage-admin/(admin-dashboard)/networkchains/funnels/page.tsx`
