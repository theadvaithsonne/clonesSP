# `components/dashboard/inlineApps/teamforce/sections/AddEmployeeSection.tsx`

> React component `AddEmployeeSection`.

**Kind:** React component · **Lines:** 862 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `X`×4 (lucide-react), `ArrowLeft`×2 (lucide-react), `Download`×2 (lucide-react), `FileText`×2 (lucide-react), `Upload`×2 (lucide-react), `Loader2`×2 (lucide-react), `BulkUploadView` (local), `InviteViaEmailView` (local), `SelectionView` (local), `Icon` (local)

### Props

- **`AddEmployeeSection`**: `onNavigate: (section: Section, userId?: string) => void`, `initialView?: View`

**Hooks used:** `useState`×16, `useRef`×2, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (AddEmployeeSection)` | component | `AddEmployeeSection({ onNavigate, initialView }: Props)` | 31 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/dashboard/inlineApps/teamforce/api.ts` — `listDepartments`, `listBranches`, `listEmployees`, `upsertEmployee`, `sendOrgInvites`
  - `components/dashboard/inlineApps/teamforce/types.ts` — `Section`, `Department`, `Branch`, `(types only)`
- **Packages:**
  - `react` — `useState`, `useEffect`, `useRef`
  - `xlsx`
  - `lucide-react` — `FileText`, `Upload`, `Mail`, `ArrowLeft`, `Download`, `Loader2`, …
  - `sonner` — `toast`

## Used by

- `components/dashboard/inlineApps/teamforce/TeamforceApp.tsx`
