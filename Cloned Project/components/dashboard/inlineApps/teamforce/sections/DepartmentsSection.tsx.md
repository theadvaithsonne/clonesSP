# `components/dashboard/inlineApps/teamforce/sections/DepartmentsSection.tsx`

> React component `DepartmentsSection`.

**Kind:** React component · **Lines:** 430 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Button`×4 (components/ui/button.tsx), `Loader2`×3 (lucide-react), `Layers`×2 (lucide-react), `Trash2`×2 (lucide-react), `Dialog`×2 (components/ui/dialog.tsx), `DialogContent`×2 (components/ui/dialog.tsx), `DialogHeader`×2 (components/ui/dialog.tsx), `DialogTitle`×2 (components/ui/dialog.tsx), `FormField`×2 (local), `Users` (lucide-react), `Pencil` (lucide-react), `DialogDescription` (components/ui/dialog.tsx), `IconInput` (local), `Tag` (lucide-react), `AlignLeft` (lucide-react), `Textarea` (components/ui/textarea.tsx), `Input` (components/ui/input.tsx)

### Props

- **`DepartmentsSection`**: `hasWriteAccess: boolean`

**Hooks used:** `useState`×10, `useEffect`×2

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (DepartmentsSection)` | component | `DepartmentsSection({ hasWriteAccess }: Props)` | 37 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/ui/button.tsx` — `Button`
  - `components/ui/input.tsx` — `Input`
  - `components/ui/textarea.tsx` — `Textarea`
  - `components/ui/dialog.tsx` — `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`
  - `components/dashboard/inlineApps/teamforce/api.ts` — `listDepartments`, `createDepartment`, `updateDepartment`, `deleteDepartment`
  - `components/dashboard/inlineApps/teamforce/types.ts` — `Department`, `(types only)`
- **Packages:**
  - `react` — `useEffect`, `useState`, `ReactNode`
  - `lucide-react` — `Plus`, `Loader2`, `Pencil`, `Trash2`, `Users`, `Layers`, …
  - `sonner` — `toast`

## Used by

- `components/dashboard/inlineApps/teamforce/TeamforceApp.tsx`
