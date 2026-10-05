# `components/dashboard/inlineApps/teamforce/sections/MySalarySlipsSection.tsx`

> React component `MySalarySlipsSection`.

**Kind:** React component · **Lines:** 372 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Loader2`×2 (lucide-react), `InfoCard` (components/dashboard/inlineApps/teamforce/lib/InfoCard.tsx), `FileText` (lucide-react), `Download` (lucide-react), `CircleCheck` (lucide-react), `Lock` (lucide-react), `ChevronRight` (lucide-react), `Receipt` (lucide-react), `SalarySlipDrawer` (components/dashboard/inlineApps/teamforce/sections/SalarySlipDrawer.tsx)

**Hooks used:** `useState`×3, `useCallback`, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (MySalarySlipsSection)` | component | `MySalarySlipsSection()` | 42 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/dashboard/inlineApps/teamforce/api.ts` — `listMyPayrollSlips`, `getMyForm16`
  - `components/dashboard/inlineApps/teamforce/types.ts` — `PayrollRun`, `PayrollRunStatus`, `PayrollTransaction`, `Form16Response`, `(types only)`
  - `components/dashboard/inlineApps/teamforce/sections/SalarySlipDrawer.tsx` — `SalarySlipDrawer (default)`
  - `components/dashboard/inlineApps/teamforce/lib/payrollFormat.ts` — `INR`, `fyMonthLabel`, `fmtDate`
  - `components/dashboard/inlineApps/teamforce/lib/InfoCard.tsx` — `InfoCard (default)`
- **Packages:**
  - `react` — `useState`, `useEffect`, `useCallback`
  - `lucide-react` — `Loader2`, `FileText`, `Lock`, `CircleCheck`, `ChevronRight`, `Receipt`, …
  - `sonner` — `toast`

## Used by

- `components/dashboard/inlineApps/teamforce/TeamforceApp.tsx`
