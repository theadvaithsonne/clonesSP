# `components/garage-admin/AdminAccessMatrix.tsx`

> The right-hand panel of the invite dialog and the body of the "Edit access" sheet: pick a role name, then set a level per page.

**Kind:** React component · **Lines:** 397 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The right-hand panel of the invite dialog and the body of the
"Edit access" sheet: pick a role name, then set a level per page.

Three levels, one control: No access / View only / Full access. Two
checkboxes would say the same thing with twice the clicks, and "can open
Withdrawals" versus "can approve one" is exactly the distinction a super
admin is trying to draw.

Nothing super-admin-only appears here, by construction — the catalogue
comes from the backend's ADMIN_PAGES, and super-admin capabilities were
deliberately left out of it. There is no checkbox that could grant them.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Settings2` (lucide-react), `RoleCombobox` (local), `AccessGrid` (components/garage-admin/AccessGrid.tsx), `ManageRolesDialog` (components/garage-admin/ManageRolesDialog.tsx), `ShieldCheck` (lucide-react), `Input` (components/ui/input.tsx), `ChevronDown` (lucide-react), `Plus` (lucide-react), `Pencil` (lucide-react), `Check` (lucide-react)

### Props

- **`AdminAccessMatrix`**: `catalogue: AdminPageCatalogue | null`, `role: string`, `onRoleChange: (role: string) => void`, `permissions: Record<string, AdminPageLevel>`, `onPermissionsChange: (next: Record<string, AdminPageLevel>) => void`, `existingRoles?: { role: string; permissions: Record<string, AdminPage…`, `onRoleCreated?: () => void`, `className?: string`

**Hooks used:** `useState`×4, `useMemo`×2, `useRef`, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (AdminAccessMatrix)` | component | `AdminAccessMatrix({ catalogue, role, onRoleChange, permissions, onPermissions…)` | 33 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/utils.ts` — `cn`
  - `components/ui/input.tsx` — `Input`
  - `components/garage-admin/ManageRolesDialog.tsx` — `ManageRolesDialog (default)`
  - `components/garage-admin/AccessGrid.tsx` — `AccessGrid (default)`
  - `lib/admin-api/permissions.ts` — `AdminPageCatalogue`, `AdminPageLevel`, `AdminRolePreset`, `(types only)`
  - `lib/admin-api/permissions.ts` — `countGranted`, `createAdminRole`, `updateAdminRole`
- **Packages:**
  - `react` — `useEffect`, `useMemo`, `useRef`, `useState`
  - `sonner` — `toast`
  - `lucide-react` — `Check`, `ChevronDown`, `Pencil`, `Plus`, `ShieldCheck`, `Settings2`

## Used by

- `components/garage-admin/EditAdminAccessDialog.tsx`
- `components/garage-admin/InviteAdminDialog.tsx`
