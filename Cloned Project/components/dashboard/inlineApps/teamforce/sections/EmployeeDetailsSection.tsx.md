# `components/dashboard/inlineApps/teamforce/sections/EmployeeDetailsSection.tsx`

> React component `EmployeeDetailsSection`.

**Kind:** React component · **Lines:** 382 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `DetailField`×14 (local), `SectionBlock`×4 (local), `PanelRow`×4 (local), `SidePanel`×3 (local), `Avatar`×2 (local), `ChartCard`×2 (local), `Loader2` (lucide-react), `ArrowLeft` (lucide-react)

### Props

- **`EmployeeDetailsSection`**: `userId?: string | null`, `onNavigate: (section: Section) => void`, `canEdit?: boolean`, `onEdit?: () => void`, `editLabel?: string`

**Hooks used:** `useState`×3, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (EmployeeDetailsSection)` | component | `EmployeeDetailsSection({ userId, onNavigate, canEdit = false, onEdit, editLabel = …)` — Read-only employee details page. | 96 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/dashboard/inlineApps/teamforce/api.ts` — `getEmployee`, `listEmployees`
  - `components/dashboard/inlineApps/teamforce/types.ts` — `EmployeeListItem`, `Section`, `(types only)`
- **Packages:**
  - `react` — `useEffect`, `useState`, `ReactNode`
  - `lucide-react` — `ArrowLeft`, `Loader2`
  - `sonner` — `toast`

## Used by

- `components/dashboard/inlineApps/teamforce/TeamforceApp.tsx`
