# `components/dashboard/teamAccess/TeamAccessPage.tsx`

> Team & Access — the founder's delegation console.

**Kind:** React component · **Lines:** 1103 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
Team & Access — the founder's delegation console.

This table is a list of *delegations*, not a directory. A member only earns a
row once they hold a module, have a live offer, or have one that lapsed.
Everyone else stays out of the way until they're invited — otherwise a
400-person office buries the three people who actually have access.

Two backend rules drive every action here:
  - Granting is an OFFER. It creates a pending grant with a 24h expiry and
    changes nothing until the member accepts.
  - Revoking is an ACT. It applies immediately and cancels any live offer for
    the same module.

Three sources feed one row:
  permissions[mod] === true   -> Admin    (live access)
  pending[mod]                -> Pending  (unanswered, clock running) […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `DropdownMenuItem`×10 (components/ui/dropdown-menu.tsx), `DropdownMenu`×4 (components/ui/dropdown-menu.tsx), `DropdownMenuTrigger`×4 (components/ui/dropdown-menu.tsx), `DropdownMenuContent`×4 (components/ui/dropdown-menu.tsx), `Search`×3 (lucide-react), `EmptyCard`×3 (local), `DropdownMenuSeparator`×3 (components/ui/dropdown-menu.tsx), `DropdownMenuLabel`×3 (components/ui/dropdown-menu.tsx), `Info`×2 (lucide-react), `Icon`×2 (local), `Loader2`×2 (lucide-react), `ChevronRight`×2 (lucide-react), `UserPlus`×2 (lucide-react), `X`×2 (lucide-react), `AdminPill`×2 (components/dashboard/teamAccess/shared.tsx), `Popover` (components/ui/popover.tsx), `PopoverTrigger` (components/ui/popover.tsx), `PopoverContent` (components/ui/popover.tsx), `AlertTriangle` (lucide-react), `History` (lucide-react), `PermissionReference` (local), `RefreshCw` (lucide-react), `ShieldOff` (lucide-react), `Users` (lucide-react), `MemberAvatar` (components/dashboard/teamAccess/shared.tsx), `RoleBadge` (components/dashboard/teamAccess/shared.tsx), `PendingPill` (components/dashboard/teamAccess/shared.tsx), `ExpiredPill` (components/dashboard/teamAccess/shared.tsx), `NoAccessPill` (components/dashboard/teamAccess/shared.tsx), `StatusDot` (components/dashboard/teamAccess/shared.tsx), `MoreHorizontal` (lucide-react), `ChevronLeft` (lucide-react), `AnimatePresence` (framer-motion), `ConfirmRevoke` (local), `InvitePeopleDialog` (components/dashboard/teamAccess/InvitePeopleDialog.tsx), `AccessAuditLogDialog` (components/dashboard/teamAccess/AccessAuditLog.tsx), `MemberAccessSheet` (components/dashboard/teamAccess/MemberAccessSheet.tsx)

**Hooks used:** `useState`×16, `useCallback`×6, `useMemo`×4, `useEffect`×2

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (TeamAccessPage)` | component | `TeamAccessPage()` | 258 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/utils.ts` — `cn`
  - `lib/rbac-api.ts` — `cancelGrant`, `createGrants`, `fetchAllMembers`, `fetchAuditTrail`, `hasAnyAccess`, `notifyRbacChanged`, `resendGrant`, `revokeAllModules`, … +6
  - `components/ui/dropdown-menu.tsx` — `DropdownMenu`, `DropdownMenuContent`, `DropdownMenuItem`, `DropdownMenuLabel`, `DropdownMenuSeparator`, `DropdownMenuTrigger`
  - `components/ui/popover.tsx` — `Popover`, `PopoverContent`, `PopoverTrigger`
  - `components/dashboard/teamAccess/shared.tsx` — `AdminPill`, `ExpiredPill`, `MemberAvatar`, `moduleIcon`, `NoAccessPill`, `PendingPill`, `RoleBadge`, `StatusDot`, … +1
  - `components/dashboard/teamAccess/MemberAccessSheet.tsx` — `MemberAccessSheet (default)`
  - `components/dashboard/teamAccess/AccessAuditLog.tsx` — `AccessAuditLogDialog (default)`
  - `components/dashboard/teamAccess/InvitePeopleDialog.tsx` — `InvitePeopleDialog (default)`
- **Packages:**
  - `react` — `useCallback`, `useEffect`, `useMemo`, `useState`
  - `framer-motion` — `AnimatePresence`, `motion`
  - `lucide-react` — `AlertTriangle`, `ChevronLeft`, `ChevronRight`, `History`, `Info`, `Loader2`, …
  - `sonner` — `toast`

## Used by

- `app/(dashboard)/settings/team-access/page.tsx`
- `components/dashboard/ManagementPage.tsx`
