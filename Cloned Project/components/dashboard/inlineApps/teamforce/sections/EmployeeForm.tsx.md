# `components/dashboard/inlineApps/teamforce/sections/EmployeeForm.tsx`

> React component `EmployeeForm`.

**Kind:** React component · **Lines:** 1157 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Field`×36 (local), `Input`×22 (components/ui/input.tsx), `SelectItem`×16 (components/ui/select.tsx), `Select`×12 (components/ui/select.tsx), `SelectTrigger`×12 (components/ui/select.tsx), `SelectValue`×12 (components/ui/select.tsx), `SelectContent`×12 (components/ui/select.tsx), `FormCard`×10 (local), `InfoCard`×4 (components/dashboard/inlineApps/teamforce/lib/InfoCard.tsx), `Trash2`×4 (lucide-react), `Loader2`×3 (lucide-react), `Checkbox`×3 (components/ui/checkbox.tsx), `AddButton`×3 (local), `Textarea`×2 (components/ui/textarea.tsx), `Button`×2 (components/ui/button.tsx), `ArrowLeft` (lucide-react), `Check` (lucide-react), `Upload` (lucide-react), `Icon` (local), `Plus` (lucide-react)

### Props

- **`EmployeeForm`**: `mode: "add" | "edit"`, `userId?: string | null`, `hasWriteAccess: boolean`, `selfEdit?: boolean`, `onboarding?: boolean`, `onOnboardingComplete?: () => void`, `onNavigate: (section: Section) => void`

**Hooks used:** `useState`×32, `useEffect`×2

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (EmployeeForm)` | component | `EmployeeForm({ mode, userId, hasWriteAccess, selfEdit = false, onboardin…)` | 87 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/ui/button.tsx` — `Button`
  - `components/ui/input.tsx` — `Input`
  - `components/ui/textarea.tsx` — `Textarea`
  - `components/ui/checkbox.tsx` — `Checkbox`
  - `components/ui/select.tsx` — `Select`, `SelectContent`, `SelectItem`, `SelectTrigger`, `SelectValue`
  - `components/dashboard/inlineApps/teamforce/api.ts` — `getEmployee`, `upsertEmployee`, `updateEmployeeProfile`, `listBranches`, `listDepartments`, `listShifts`, `listWeeklyOffPatterns`, `listEmployees`, … +3
  - `components/dashboard/inlineApps/teamforce/types.ts` — `Branch`, `Department`, `Shift`, `WeeklyOffPattern`, `EducationEntry`, `WorkExperienceEntry`, `CustomAmount`, `EmployeeListItem`, … +3
  - `components/dashboard/inlineApps/teamforce/lib/InfoCard.tsx` — `InfoCard (default)`
  - `lib/auth.ts` — `getUserIdFromToken`
- **Packages:**
  - `react` — `useState`, `useEffect`, `ReactNode`
  - `lucide-react` — `ArrowLeft`, `Loader2`, `Plus`, `Trash2`, `Upload`, `Check`, …
  - `sonner` — `toast`

## Used by

- `components/dashboard/inlineApps/teamforce/TeamforceApp.tsx`
