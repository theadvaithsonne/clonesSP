# `components/dashboard/docusign/shared/admin/RoleSelect.tsx`

> React component `RoleSelect`.

**Kind:** React component · **Lines:** 77 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `DropdownMenuItem`×2 (components/ui/dropdown-menu.tsx), `DropdownMenu` (components/ui/dropdown-menu.tsx), `DropdownMenuTrigger` (components/ui/dropdown-menu.tsx), `Loader2` (lucide-react), `ChevronDown` (lucide-react), `DropdownMenuContent` (components/ui/dropdown-menu.tsx), `Check` (lucide-react), `DropdownMenuSeparator` (components/ui/dropdown-menu.tsx)

### Props

- **`RoleSelect`**: `value: DsRole`, `onChange: (role: DsAssignableRole) => void`, `isSaving?: boolean`, `memberLabel: string`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `RoleSelect` | component | `RoleSelect({ value, onChange, isSaving, memberLabel }: RoleSelectProps)` | 28 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/utils.ts` — `cn`
  - `components/ui/dropdown-menu.tsx` — `DropdownMenu`, `DropdownMenuContent`, `DropdownMenuItem`, `DropdownMenuSeparator`, `DropdownMenuTrigger`
  - `lib/docusign/types.ts` — `DsAssignableRole`, `DsRole`, `(types only)`
- **Packages:**
  - `lucide-react` — `Check`, `ChevronDown`, `Loader2`

## Used by

- `components/dashboard/docusign/shared/admin/MembersTab.tsx`
