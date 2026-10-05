# `components/dashboard/inlineApps/teamforce/sections/EmployeesSection.tsx`

> React component `EmployeesSection`.

**Kind:** React component · **Lines:** 1332 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Select`×10 (components/ui/select.tsx), `SelectTrigger`×10 (components/ui/select.tsx), `SelectValue`×10 (components/ui/select.tsx), `SelectContent`×10 (components/ui/select.tsx), `SelectItem`×10 (components/ui/select.tsx), `Input`×4 (components/ui/input.tsx), `Checkbox`×4 (components/ui/checkbox.tsx), `EmployeeAvatar`×4 (local), `Calendar`×2 (lucide-react), `Search`×2 (lucide-react), `Button`×2 (components/ui/button.tsx), `Loader2`×2 (lucide-react), `Crown`×2 (lucide-react), `Badge`×2 (components/ui/badge.tsx), `DropdownMenu`×2 (components/ui/dropdown-menu.tsx), `DropdownMenuTrigger`×2 (components/ui/dropdown-menu.tsx), `MoreHorizontal`×2 (lucide-react), `DropdownMenuContent`×2 (components/ui/dropdown-menu.tsx), `DropdownMenuItem`×2 (components/ui/dropdown-menu.tsx), `ShieldOff`×2 (lucide-react), `Shield`×2 (lucide-react), `UserCircle` (lucide-react), `ChevronLeft` (lucide-react), `ChevronRight` (lucide-react)

### Props

- **`EmployeesSection`**: `hasWriteAccess: boolean`, `isFounder: boolean`, `onNavigate: (section: Section, userId?: string) => void`, `initialBulkMode?: boolean`

**Hooks used:** `useState`×12, `useEffect`×6, `useMemo`×3

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (EmployeesSection)` | component | `EmployeesSection({ hasWriteAccess, isFounder, onNavigate, initialBulkMode = …)` | 185 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/ui/button.tsx` — `Button`
  - `components/ui/badge.tsx` — `Badge`
  - `components/ui/checkbox.tsx` — `Checkbox`
  - `components/ui/input.tsx` — `Input`
  - `components/ui/select.tsx` — `Select`, `SelectContent`, `SelectItem`, `SelectTrigger`, `SelectValue`
  - `components/ui/dropdown-menu.tsx` — `DropdownMenu`, `DropdownMenuContent`, `DropdownMenuItem`, `DropdownMenuTrigger`
  - `components/dashboard/inlineApps/teamforce/api.ts` — `listEmployees`, `listDepartments`, `listShifts`, `listWeeklyOffPatterns`, `createShift`, `createWeeklyOffPattern`, `updateEmployeeProfile`, `setTeamforceRole`
  - `components/dashboard/inlineApps/teamforce/types.ts` — `EmployeeListItem`, `EmployeeStatus`, `Section`, `Department`, `Shift`, `WeeklyOffPattern`, `(types only)`
- **Packages:**
  - `react` — `useEffect`, `useMemo`, `useState`
  - `lucide-react` — `Search`, `Loader2`, `Crown`, `UserCircle`, `ChevronLeft`, `ChevronRight`, …
  - `sonner` — `toast`

## Used by

- `components/dashboard/inlineApps/teamforce/TeamforceApp.tsx`
