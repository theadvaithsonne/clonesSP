# `components/coverfi/corporate/EmployeeFormDialog.tsx`

> React component `EmployeeFormDialog`.

**Kind:** React component · **Lines:** 202 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Field`×8 (local), `Input`×8 (components/ui/input.tsx), `Button`×2 (components/ui/button.tsx), `Dialog` (components/ui/dialog.tsx), `DialogContent` (components/ui/dialog.tsx), `DialogHeader` (components/ui/dialog.tsx), `DialogTitle` (components/ui/dialog.tsx), `DialogFooter` (components/ui/dialog.tsx), `Label` (components/ui/label.tsx)

### Props

- **`EmployeeFormDialog`**: `open: boolean`, `onClose: () => void`, `onSaved: () => void`, `corporateId: string`, `existing?: CorporateEmployee | null`

**Hooks used:** `useState`×2, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (EmployeeFormDialog)` | component | `EmployeeFormDialog({ open, onClose, onSaved, corporateId, existing, }: Props)` | 40 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/ui/dialog.tsx` — `Dialog`, `DialogContent`, `DialogFooter`, `DialogHeader`, `DialogTitle`
  - `components/ui/input.tsx` — `Input`
  - `components/ui/label.tsx` — `Label`
  - `components/ui/button.tsx` — `Button`
  - `lib/coverfi/corporate-api.ts` — `createCorporateEmployee`, `updateCorporateEmployee`
  - `lib/coverfi/types.ts` — `CorporateEmployee`, `(types only)`
- **Packages:**
  - `react` — `useEffect`, `useState`
  - `sonner` — `toast`

## Used by

- `components/coverfi/corporate/CorporateEmployeesTab.tsx`
- `components/coverfi/corporate/CorporateStep3Employees.tsx`
