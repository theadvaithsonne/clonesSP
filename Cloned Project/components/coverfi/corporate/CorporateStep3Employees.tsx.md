# `components/coverfi/corporate/CorporateStep3Employees.tsx`

> React component `CorporateStep3Employees`.

**Kind:** React component · **Lines:** 159 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `TableCell`×7 (components/ui/table.tsx), `TableHead`×5 (components/ui/table.tsx), `TableRow`×4 (components/ui/table.tsx), `Button`×3 (components/ui/button.tsx), `Badge`×3 (components/ui/badge.tsx), `Plus` (lucide-react), `Table` (components/ui/table.tsx), `TableHeader` (components/ui/table.tsx), `TableBody` (components/ui/table.tsx), `ShieldCheck` (lucide-react), `EmployeeFormDialog` (components/coverfi/corporate/EmployeeFormDialog.tsx)

### Props

- **`CorporateStep3Employees`**: `corporate: Corporate`, `onSaved: (c: Corporate) => void`, `onBack: () => void`

**Hooks used:** `useState`×4, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (CorporateStep3Employees)` | component | `CorporateStep3Employees({ corporate, onSaved, onBack, }: Props)` | 29 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/ui/button.tsx` — `Button`
  - `components/ui/badge.tsx` — `Badge`
  - `components/ui/table.tsx` — `Table`, `TableBody`, `TableCell`, `TableHead`, `TableHeader`, `TableRow`
  - `components/coverfi/corporate/EmployeeFormDialog.tsx` — `EmployeeFormDialog (default)`
  - `lib/coverfi/corporate-api.ts` — `listCorporateEmployees`, `createCorporateStep3`
  - `lib/coverfi/types.ts` — `Corporate`, `CorporateEmployee`, `(types only)`
- **Packages:**
  - `react` — `useEffect`, `useState`
  - `lucide-react` — `Plus`, `ShieldCheck`
  - `sonner` — `toast`

## Used by

- `components/coverfi/corporate/CorporateWizard.tsx`
