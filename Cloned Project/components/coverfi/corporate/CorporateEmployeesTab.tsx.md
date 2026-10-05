# `components/coverfi/corporate/CorporateEmployeesTab.tsx`

> React component `CorporateEmployeesTab`.

**Kind:** React component · **Lines:** 348 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `TableCell`×10 (components/ui/table.tsx), `TableHead`×7 (components/ui/table.tsx), `Button`×6 (components/ui/button.tsx), `TableRow`×5 (components/ui/table.tsx), `Badge`×3 (components/ui/badge.tsx), `Plus`×2 (lucide-react), `Pencil`×2 (lucide-react), `UserMinus`×2 (lucide-react), `Table` (components/ui/table.tsx), `TableHeader` (components/ui/table.tsx), `TableBody` (components/ui/table.tsx), `ChevronRight` (lucide-react), `ShieldCheck` (lucide-react), `Users` (lucide-react), `EmployeeFormDialog` (components/coverfi/corporate/EmployeeFormDialog.tsx), `DependentFormDialog` (components/coverfi/corporate/DependentFormDialog.tsx)

### Props

- **`CorporateEmployeesTab`**: `corporateId: string`, `onChanged: () => Promise<void> | void`

**Hooks used:** `useState`×9, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (CorporateEmployeesTab)` | component | `CorporateEmployeesTab({ corporateId, onChanged, }: Props)` | 43 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/ui/button.tsx` — `Button`
  - `components/ui/badge.tsx` — `Badge`
  - `components/ui/table.tsx` — `Table`, `TableBody`, `TableCell`, `TableHead`, `TableHeader`, `TableRow`
  - `components/coverfi/corporate/EmployeeFormDialog.tsx` — `EmployeeFormDialog (default)`
  - `components/coverfi/corporate/DependentFormDialog.tsx` — `DependentFormDialog (default)`
  - `lib/coverfi/corporate-api.ts` — `listCorporateEmployees`, `suspendCorporateEmployee`, `listDependentsForEmployee`, `deleteDependent`
  - `lib/coverfi/types.ts` — `CorporateDependent`, `CorporateEmployee`, `(types only)`
  - `lib/utils.ts` — `cn`
- **Packages:**
  - `react` — `useEffect`, `useState`, `Fragment`
  - `lucide-react` — `Plus`, `Pencil`, `UserMinus`, `ShieldCheck`, `Users`, `ChevronRight`
  - `sonner` — `toast`

## Used by

- `components/coverfi/corporate/CorporateDetail.tsx`
