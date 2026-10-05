# `components/dashboard/inlineApps/teamforce/sections/SalarySlipDrawer.tsx`

> React component `SalarySlipDrawer`.

**Kind:** React component · **Lines:** 600 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `OverrideField`×5 (local), `SlipBlock`×4 (local), `Loader2`×2 (lucide-react), `InfoCard`×2 (components/dashboard/inlineApps/teamforce/lib/InfoCard.tsx), `Mail` (lucide-react), `Printer` (lucide-react), `X` (lucide-react), `AlertTriangle` (lucide-react), `Pencil` (lucide-react), `Check` (lucide-react)

### Props

- **`SalarySlipDrawer`**: `tx: PayrollTransaction`, `run?: PayrollRun | null`, `editable: boolean`, `onClose: () => void`, `onSaved?: (updated: PayrollTransaction) => void`

**Hooks used:** `useState`×4, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (SalarySlipDrawer)` | component | `SalarySlipDrawer({ tx, run, editable, onClose, onSaved, }: SalarySlipDrawerP…)` | 42 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/dashboard/inlineApps/teamforce/api.ts` — `overridePayrollTransaction`, `emailPayrollSlip`
  - `components/dashboard/inlineApps/teamforce/types.ts` — `PayrollTransaction`, `PayrollRun`, `(types only)`
  - `components/dashboard/inlineApps/teamforce/lib/payrollFormat.ts` — `INR`, `fyMonthLabel`
  - `components/dashboard/inlineApps/teamforce/lib/InfoCard.tsx` — `InfoCard (default)`
- **Packages:**
  - `react` — `useState`, `useEffect`
  - `lucide-react` — `X`, `Loader2`, `Check`, `Pencil`, `AlertTriangle`, `Printer`, …
  - `sonner` — `toast`

## Used by

- `components/dashboard/inlineApps/teamforce/sections/MySalarySlipsSection.tsx`
- `components/dashboard/inlineApps/teamforce/sections/PayrollSection.tsx`
