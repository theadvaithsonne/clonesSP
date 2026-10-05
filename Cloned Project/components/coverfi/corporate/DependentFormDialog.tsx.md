# `components/coverfi/corporate/DependentFormDialog.tsx`

> React component `DependentFormDialog`.

**Kind:** React component · **Lines:** 184 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Label`×5 (components/ui/label.tsx), `Input`×4 (components/ui/input.tsx), `Button`×2 (components/ui/button.tsx), `Dialog` (components/ui/dialog.tsx), `DialogContent` (components/ui/dialog.tsx), `DialogHeader` (components/ui/dialog.tsx), `DialogTitle` (components/ui/dialog.tsx), `Select` (components/ui/select.tsx), `SelectTrigger` (components/ui/select.tsx), `SelectValue` (components/ui/select.tsx), `SelectContent` (components/ui/select.tsx), `SelectItem` (components/ui/select.tsx), `DialogFooter` (components/ui/dialog.tsx)

### Props

- **`DependentFormDialog`**: `open: boolean`, `onClose: () => void`, `onSaved: () => void`, `employeeId: string`, `existing?: CorporateDependent | null`

**Hooks used:** `useState`×2, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (DependentFormDialog)` | component | `DependentFormDialog({ open, onClose, onSaved, employeeId, existing, }: Props)` | 48 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/ui/dialog.tsx` — `Dialog`, `DialogContent`, `DialogFooter`, `DialogHeader`, `DialogTitle`
  - `components/ui/input.tsx` — `Input`
  - `components/ui/label.tsx` — `Label`
  - `components/ui/button.tsx` — `Button`
  - `components/ui/select.tsx` — `Select`, `SelectContent`, `SelectItem`, `SelectTrigger`, `SelectValue`
  - `lib/coverfi/corporate-api.ts` — `createDependent`, `updateDependent`
  - `lib/coverfi/types.ts` — `DEPENDENT_RELATIONS`, `CorporateDependent`, `DependentRelation`
- **Packages:**
  - `react` — `useEffect`, `useState`
  - `sonner` — `toast`

## Used by

- `components/coverfi/corporate/CorporateEmployeesTab.tsx`
