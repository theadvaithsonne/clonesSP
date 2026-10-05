# `components/dashboard/inlineApps/teamforce/sections/PayrollSection.tsx`

> React component `PayrollSection`.

**Kind:** React component · **Lines:** 2321 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Loader2`×10 (lucide-react), `Plus`×7 (lucide-react), `FormCard`×7 (local), `InfoCard`×6 (components/dashboard/inlineApps/teamforce/lib/InfoCard.tsx), `Select`×5 (components/ui/select.tsx), `SelectTrigger`×5 (components/ui/select.tsx), `SelectValue`×5 (components/ui/select.tsx), `SelectContent`×5 (components/ui/select.tsx), `SelectItem`×5 (components/ui/select.tsx), `Check`×5 (lucide-react), `Receipt`×4 (lucide-react), `Field`×4 (local), `CircleCheck`×3 (lucide-react), `ChevronRight`×3 (lucide-react), `Trash2`×3 (lucide-react), `SettingsIcon`×2 (lucide-react), `Filter`×2 (lucide-react), `ArrowLeft`×2 (lucide-react), `PlayCircle`×2 (lucide-react), `Pencil`×2 (lucide-react), `ComponentTable`×2 (local), `NumericInput`×2 (local), `Shield` (lucide-react), `SalaryStructureView` (local), `PayrollOverview` (local), `NewRunView` (local), `RunDetailView` (local), `Lock` (lucide-react), `CalendarRange` (lucide-react), `Mail` (lucide-react), `FileText` (lucide-react), `SalarySlipDrawer` (components/dashboard/inlineApps/teamforce/sections/SalarySlipDrawer.tsx), `AuditLogDrawer` (local), `History` (lucide-react), `X` (lucide-react), `Icon` (local), `AlertTriangle` (lucide-react)

**Hooks used:** `useState`×29, `useEffect`×7, `useCallback`×3, `useAmIFounder` (lib/hooks/useAmIFounder.ts)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (PayrollSection)` | component | `PayrollSection()` | 89 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/ui/select.tsx` — `Select`, `SelectContent`, `SelectItem`, `SelectTrigger`, `SelectValue`
  - `lib/hooks/useAmIFounder.ts` — `useAmIFounder`
  - `lib/auth.ts` — `getUserIdFromToken`
  - `components/dashboard/inlineApps/teamforce/api.ts` — `getEmployee`, `listEmployees`, `listSalaryStructures`, `createSalaryStructure`, `updateSalaryStructure`, `deleteSalaryStructure`, `getSalaryStructureDefaults`, `listPayrollRuns`, … +11
  - `components/dashboard/inlineApps/teamforce/types.ts` — `SalaryStructure`, `SalaryComponent`, `ComponentCode`, `TaxabilityType`, `CalcType`, `TaxRegime`, `PayrollRun`, `PayrollRunStatus`, … +8
  - `components/dashboard/inlineApps/teamforce/sections/SalarySlipDrawer.tsx` — `SalarySlipDrawer (default)`
  - `components/dashboard/inlineApps/teamforce/lib/InfoCard.tsx` — `InfoCard (default)`
- **Packages:**
  - `react` — `useState`, `useEffect`, `useCallback`
  - `sonner` — `toast`
  - `lucide-react` — `DollarSign`, `Receipt`, `TrendingUp`, `Settings as SettingsIcon`, `ChevronLeft`, `ChevronRight`, …

## Used by

- `components/dashboard/inlineApps/teamforce/TeamforceApp.tsx`

## Notes

- Large file (2321 lines) — read it by section; line numbers above point into it.
