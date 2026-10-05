# `components/dashboard/docusign/shared/admin/MembersTab.tsx`

> React component `MembersTab`.

**Kind:** React component · **Lines:** 340 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `RoleSelect` (components/dashboard/docusign/shared/admin/RoleSelect.tsx), `Search` (lucide-react), `Users` (lucide-react), `Avatar` (components/ui/avatar.tsx), `AvatarImage` (components/ui/avatar.tsx), `AvatarFallback` (components/ui/avatar.tsx), `SimplePagination` (components/dashboard/docusign/shared/SimplePagination.tsx)

**Hooks used:** `useState`×10, `useRef`×3, `useEffect`×3, `useMemo`×3, `useDocusignStore`×2 (store/docusign/docusignStore.ts)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `MembersTab` | component | `MembersTab()` | 37 |

## Interfaces

- **Timers / queues:** `setTimeout` at L116

## Dependencies

- **Internal:**
  - `lib/utils.ts` — `cn`
  - `lib/auth.ts` — `getOrgId`, `getUserDataFromToken`
  - `components/ui/avatar.tsx` — `Avatar`, `AvatarFallback`, `AvatarImage`
  - `store/docusign/docusignStore.ts` — `useDocusignStore`
  - `components/dashboard/docusign/shared/SimplePagination.tsx` — `SimplePagination`, `paginationRangeLabel`
  - `components/dashboard/docusign/shared/editorTokens.ts` — `ROW_NAME`, `ROW_SECONDARY`
  - `components/dashboard/docusign/shared/admin/RoleSelect.tsx` — `RoleSelect`
  - `lib/docusign/access.ts` — `ROLE_LABELS`
  - `lib/docusign/types.ts` — `DsAdminMember`, `DsAdminOverlay`, `DsAssignableRole`, `DsPagination`, `DsRole`, `(types only)`
  - `lib/docusign/shared-api.ts` — `listDocusignRoleHolders`, `listDocusignAdminOverlay`, `setDocusignMemberRole`
- **Packages:**
  - `react` — `useEffect`, `useMemo`, `useRef`, `useState`
  - `sonner` — `toast`
  - `lucide-react` — `Search`, `Users`

## Used by

- `components/dashboard/docusign/shared/AdminPanel.tsx`
