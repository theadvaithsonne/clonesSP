# `components/dashboard/teamAccess/AccessAuditLog.tsx`

> Every grant and revoke ever made in this org (`GET /rbac/grants`).

**Kind:** React component · **Lines:** 332 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
Every grant and revoke ever made in this org (`GET /rbac/grants`).

Grant rows are never deleted — expiry flips a status — so this is the full
record of who delegated what and whether it was taken up.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `DropdownMenu`×3 (components/ui/dropdown-menu.tsx), `DropdownMenuTrigger`×3 (components/ui/dropdown-menu.tsx), `DropdownMenuContent`×3 (components/ui/dropdown-menu.tsx), `History`×2 (lucide-react), `DropdownMenuItem` (components/ui/dropdown-menu.tsx), `Loader2` (lucide-react), `MinusCircle` (lucide-react), `PlusCircle` (lucide-react), `MemberAvatar` (components/dashboard/teamAccess/shared.tsx), `Icon` (local), `StatusChip` (components/dashboard/teamAccess/shared.tsx), `ChevronLeft` (lucide-react), `ChevronRight` (lucide-react), `AnimatePresence` (framer-motion), `X` (lucide-react), `AccessAuditLogBody` (local)

### Props

- **`AccessAuditLogBody`**: `modules: RbacModule[]`
- **`AccessAuditLogDialog`**: `open: boolean`, `modules: RbacModule[]`, `onClose: () => void`

**Hooks used:** `useState`×9, `useEffect`×2, `useCallback`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `AccessAuditLogBody` | component | `AccessAuditLogBody({ modules }: { modules: RbacModule[] })` | 50 |
| `default (AccessAuditLogDialog)` | component | `AccessAuditLogDialog({ open, modules, onClose, }: { open: boolean; modules: Rbac…)` — The audit trail as a modal, opened from "View audit log" in the page header. | 271 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/utils.ts` — `cn`
  - `lib/rbac-api.ts` — `fetchAuditTrail`, `GrantHistoryEntry`, `GrantStatus`, `ModuleKey`, `RbacError`, `RbacModule`
  - `components/ui/dropdown-menu.tsx` — `DropdownMenu`, `DropdownMenuContent`, `DropdownMenuItem`, `DropdownMenuTrigger`
  - `components/dashboard/teamAccess/shared.tsx` — `MemberAvatar`, `moduleIcon`, `relativeTime`, `StatusChip`
- **Packages:**
  - `react` — `useCallback`, `useEffect`, `useState`
  - `framer-motion` — `AnimatePresence`, `motion`
  - `lucide-react` — `ChevronLeft`, `ChevronRight`, `History`, `Loader2`, `MinusCircle`, `PlusCircle`, …

## Used by

- `components/dashboard/teamAccess/TeamAccessPage.tsx`
