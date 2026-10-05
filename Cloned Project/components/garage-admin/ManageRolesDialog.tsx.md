# `components/garage-admin/ManageRolesDialog.tsx`

> A roomy home for managing created roles — rename and delete — separate from the invite dialog's role dropdown, which was too cramped to also be a management surface.

**Kind:** React component · **Lines:** 259 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
A roomy home for managing created roles — rename and delete — separate
from the invite dialog's role dropdown, which was too cramped to also be
a management surface.

This opens from INSIDE the invite dialog (itself a Radix modal). Two ways
that went wrong and how this settles them:
  • A hand-rolled portal overlay showed on top but was DEAD to input —
    the parent dialog's focus trap stole every click and keystroke back,
    because the portal lived outside Radix's layer system.
  • So this is a real Radix <Dialog>: Radix hands the focus scope to the
    nested dialog, so its fields and buttons work. The one thing Radix
    doesn't do for a nested dialog is lift it above the parent — both
    default to z-[1100] — so the content z-index is raised inline, which
    also can't be purged the way an arbitrary Tailwind class can.

Scope is rename + delete only. Editing what a role GRANTS stays in the […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Loader2`×3 (lucide-react), `Dialog` (components/ui/dialog.tsx), `DialogContent` (components/ui/dialog.tsx), `DialogHeader` (components/ui/dialog.tsx), `DialogTitle` (components/ui/dialog.tsx), `ShieldCheck` (lucide-react), `Input` (components/ui/input.tsx), `Check` (lucide-react), `X` (lucide-react), `Pencil` (lucide-react), `Trash2` (lucide-react)

### Props

- **`ManageRolesDialog`**: `open: boolean`, `onOpenChange: (v: boolean) => void`, `onChanged?: () => void`

**Hooks used:** `useState`×5, `useCallback`, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (ManageRolesDialog)` | component | `ManageRolesDialog({ open, onOpenChange, onChanged, }: { open: boolean; onOpen…)` | 42 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/ui/dialog.tsx` — `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`
  - `components/ui/input.tsx` — `Input`
  - `lib/utils.ts` — `cn`
  - `lib/admin-api/permissions.ts` — `getAdminRolesInUse`, `updateAdminRole`, `deleteAdminRole`, `countGranted`, `AdminRoleInUse`
- **Packages:**
  - `react` — `useCallback`, `useEffect`, `useState`
  - `lucide-react` — `Check`, `Loader2`, `Pencil`, `ShieldCheck`, `Trash2`, `X`
  - `sonner` — `toast`

## Used by

- `components/garage-admin/AdminAccessMatrix.tsx`
