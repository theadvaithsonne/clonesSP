# `components/dashboard/inlineApps/teamforce/TeamforceApp.tsx`

> React component `TeamforceApp`.

**Kind:** React component · **Lines:** 645 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `EmployeeForm`×4 (components/dashboard/inlineApps/teamforce/sections/EmployeeForm.tsx), `EmployeesSection`×2 (components/dashboard/inlineApps/teamforce/sections/EmployeesSection.tsx), `AddEmployeeSection`×2 (components/dashboard/inlineApps/teamforce/sections/AddEmployeeSection.tsx), `DashboardSection` (components/dashboard/inlineApps/teamforce/sections/DashboardSection.tsx), `EmployeeDetailOrEdit` (local), `DepartmentsSection` (components/dashboard/inlineApps/teamforce/sections/DepartmentsSection.tsx), `BranchesSection` (components/dashboard/inlineApps/teamforce/sections/BranchesSection.tsx), `AttendanceSection` (components/dashboard/inlineApps/teamforce/sections/AttendanceSection.tsx), `PayrollSection` (components/dashboard/inlineApps/teamforce/sections/PayrollSection.tsx), `TaxDeclarationSection` (components/dashboard/inlineApps/teamforce/sections/TaxDeclarationSection.tsx), `MySalarySlipsSection` (components/dashboard/inlineApps/teamforce/sections/MySalarySlipsSection.tsx), `RecruitmentSection` (components/dashboard/inlineApps/teamforce/sections/RecruitmentSection.tsx), `SettingsSection` (components/dashboard/inlineApps/teamforce/sections/SettingsSection.tsx), `Loader2` (lucide-react), `EmployeeDetailsSection` (components/dashboard/inlineApps/teamforce/sections/EmployeeDetailsSection.tsx), `Lock` (lucide-react), `EyeOff` (lucide-react), `Eye` (lucide-react), `ArrowRight` (lucide-react)

### Props

- **`TeamforceApp`**: `props: InlineAppProps`

**Hooks used:** `useState`×11, `useEffect`×6, `useCallback`×2, `useAmIFounder` (lib/hooks/useAmIFounder.ts)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (TeamforceApp)` | component | `TeamforceApp({ onClose, section }: InlineAppProps)` | 138 |

## Interfaces

- **Timers / queues:** `setTimeout` at L538

## Dependencies

- **Internal:**
  - `lib/hooks/useAmIFounder.ts` — `useAmIFounder`
  - `lib/auth.ts` — `getUserIdFromToken`
  - `components/dashboard/inlineApps/teamforce/api.ts` — `getEmployee`
  - `components/dashboard/inlineApps/teamforce/types.ts` — `Section`, `(types only)`
  - `components/dashboard/inlineApps/registry.ts` — `InlineAppProps`, `(types only)`
  - `components/dashboard/inlineApps/teamforce/sections/DashboardSection.tsx` — `DashboardSection (default)`
  - `components/dashboard/inlineApps/teamforce/sections/EmployeesSection.tsx` — `EmployeesSection (default)`
  - `components/dashboard/inlineApps/teamforce/sections/BranchesSection.tsx` — `BranchesSection (default)`
  - `components/dashboard/inlineApps/teamforce/sections/DepartmentsSection.tsx` — `DepartmentsSection (default)`
  - `components/dashboard/inlineApps/teamforce/sections/AttendanceSection.tsx` — `AttendanceSection (default)`
  - `components/dashboard/inlineApps/teamforce/sections/PayrollSection.tsx` — `PayrollSection (default)`
  - `components/dashboard/inlineApps/teamforce/sections/TaxDeclarationSection.tsx` — `TaxDeclarationSection (default)`
  - `components/dashboard/inlineApps/teamforce/sections/MySalarySlipsSection.tsx` — `MySalarySlipsSection (default)`
  - `components/dashboard/inlineApps/teamforce/sections/RecruitmentSection.tsx` — `RecruitmentSection (default)`
  - `components/dashboard/inlineApps/teamforce/sections/SettingsSection.tsx` — `SettingsSection (default)`
  - `components/dashboard/inlineApps/teamforce/sections/EmployeeForm.tsx` — `EmployeeForm (default)`
  - `components/dashboard/inlineApps/teamforce/sections/EmployeeDetailsSection.tsx` — `EmployeeDetailsSection (default)`
  - `components/dashboard/inlineApps/teamforce/sections/AddEmployeeSection.tsx` — `AddEmployeeSection (default)`
- **Packages:**
  - `react` — `useState`, `useEffect`, `useCallback`, `FormEvent`
  - `lucide-react` — `LayoutDashboard`, `Users`, `Building`, `GitBranch`, `CalendarCheck`, `DollarSign`, …

## Used by

- `components/dashboard/inlineApps/registry.ts`
