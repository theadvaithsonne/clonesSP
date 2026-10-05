# `components/dashboard/inlineApps/teamforce/sections/SettingsSection.tsx`

> React component `SettingsSection`.

**Kind:** React component · **Lines:** 2358 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Field`×21 (local), `Loader2`×14 (lucide-react), `Card`×12 (local), `Plus`×9 (lucide-react), `Check`×8 (lucide-react), `X`×5 (lucide-react), `Trash2`×5 (lucide-react), `EmptyRow`×4 (local), `Pencil`×4 (lucide-react), `CheckRow`×4 (local), `InfoCard`×3 (components/dashboard/inlineApps/teamforce/lib/InfoCard.tsx), `Toggle`×2 (local), `Select`×2 (components/ui/select.tsx), `SelectTrigger`×2 (components/ui/select.tsx), `SelectValue`×2 (components/ui/select.tsx), `SelectContent`×2 (components/ui/select.tsx), `SelectItem`×2 (components/ui/select.tsx), `RefreshCw`×2 (lucide-react), `Shield` (lucide-react), `Icon` (local), `ShiftsTab` (local), `PatternsTab` (local), `PoliciesTab` (local), `BreakPolicyTab` (local), `PayrollConfigTab` (local), `PTSlabsTab` (local), `Lock` (lucide-react), `Percent` (lucide-react), `ChevronDown` (lucide-react), `ChevronRight` (lucide-react), `PTSlabRow` (local)

**Hooks used:** `useState`×39, `useEffect`×7, `useCallback`×6, `useAmIFounder`×2 (lib/hooks/useAmIFounder.ts)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (SettingsSection)` | component | `SettingsSection()` | 100 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/ui/select.tsx` — `Select`, `SelectContent`, `SelectItem`, `SelectTrigger`, `SelectValue`
  - `lib/hooks/useAmIFounder.ts` — `useAmIFounder`
  - `lib/auth.ts` — `getUserIdFromToken`
  - `components/dashboard/inlineApps/teamforce/api.ts` — `getEmployee`, `listShifts`, `createShift`, `updateShift`, `deleteShift`, `listWeeklyOffPatterns`, `createWeeklyOffPattern`, `updateWeeklyOffPattern`, … +18
  - `components/dashboard/inlineApps/teamforce/types.ts` — `Shift`, `WeeklyOffPattern`, `LeavePolicy`, `LeavePolicyApplicableFor`, `LeavePolicyType`, `BreakPolicy`, `BreakScopeType`, `Department`, … +3
  - `components/dashboard/inlineApps/teamforce/lib/InfoCard.tsx` — `InfoCard (default)`
- **Packages:**
  - `react` — `useState`, `useEffect`, `useCallback`
  - `lucide-react` — `Clock`, `Calendar as CalendarIcon`, `Shield`, `Plus`, `Pencil`, `Trash2`, …
  - `sonner` — `toast`

## Used by

- `components/dashboard/inlineApps/teamforce/TeamforceApp.tsx`

## Notes

- Large file (2358 lines) — read it by section; line numbers above point into it.
