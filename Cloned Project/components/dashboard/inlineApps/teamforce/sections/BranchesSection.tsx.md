# `components/dashboard/inlineApps/teamforce/sections/BranchesSection.tsx`

> React component `BranchesSection`.

**Kind:** React component · **Lines:** 585 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `FormField`×6 (local), `IconInput`×5 (local), `Loader2`×4 (lucide-react), `Building2`×4 (lucide-react), `Button`×4 (components/ui/button.tsx), `AlertCircle`×3 (lucide-react), `Trash2`×2 (lucide-react), `MapPin`×2 (lucide-react), `Dialog`×2 (components/ui/dialog.tsx), `DialogContent`×2 (components/ui/dialog.tsx), `DialogHeader`×2 (components/ui/dialog.tsx), `DialogTitle`×2 (components/ui/dialog.tsx), `Input`×2 (components/ui/input.tsx), `Pencil` (lucide-react), `DialogDescription` (components/ui/dialog.tsx), `Hash` (lucide-react), `Mail` (lucide-react), `Check` (lucide-react), `Map` (lucide-react), `Globe` (lucide-react)

### Props

- **`BranchesSection`**: `hasWriteAccess: boolean`

**Hooks used:** `useState`×13, `useEffect`×3, `useRef`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (BranchesSection)` | component | `BranchesSection({ hasWriteAccess }: Props)` | 41 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/org/resolve-pincode?${params.toString()}` (L91)
- **Timers / queues:** `setTimeout` at L120

## Dependencies

- **Internal:**
  - `components/ui/button.tsx` — `Button`
  - `components/ui/input.tsx` — `Input`
  - `components/ui/dialog.tsx` — `Dialog`, `DialogContent`, `DialogDescription`, `DialogHeader`, `DialogTitle`
  - `lib/api.ts` — `api`
  - `components/dashboard/inlineApps/teamforce/api.ts` — `listBranches`, `createBranch`, `updateBranch`, `deleteBranch`
  - `components/dashboard/inlineApps/teamforce/types.ts` — `Branch`, `(types only)`
- **Packages:**
  - `react` — `useEffect`, `useRef`, `useState`, `ReactNode`
  - `lucide-react` — `Plus`, `Loader2`, `Pencil`, `Trash2`, `MapPin`, `Building2`, …
  - `sonner` — `toast`

## Used by

- `components/dashboard/inlineApps/teamforce/TeamforceApp.tsx`
