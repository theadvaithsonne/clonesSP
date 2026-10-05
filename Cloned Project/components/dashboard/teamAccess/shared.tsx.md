# `components/dashboard/teamAccess/shared.tsx`

> Small pieces shared across the Team & Access surfaces.

**Kind:** React component · **Lines:** 273 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
Small pieces shared across the Team & Access surfaces.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Lock` (lucide-react), `Crown` (lucide-react), `ShieldCheck` (lucide-react)

### Props

- **`MemberAvatar`**: `name?: string`, `email?: string`, `src?: string`, `size?: number`, `className?: string`
- **`AdminPill`**: `locked?: boolean`
- **`PendingPill`**: `expiresAt?: string`
- **`StatusDot`**: `status: RowStatus`

**Hooks used:** `useState`×2, `useEffect`, `useCountdown` (local)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `moduleIcon` | function | `moduleIcon(key: ModuleKey): LucideIcon` | 39 |
| `getInitials` | function | `getInitials(name?: string, email?: string)` | 43 |
| `MemberAvatar` | component | `MemberAvatar({ name, email, src, size = 36, className, }: { name?: strin…)` | 50 |
| `useCountdown` | hook | `useCountdown(expiresAt?: string \| null, short = false)` — Live "23h 12m left" label — recomputed every 30s. | 93 |
| `ADMIN_ACCENT` | const | `= { text: "text-[#F87171]", dot: "bg-[#F87171]", chip: "border-[#EF4444]/30 bg-[#EF4444]/…` — Admin is the elevated state, so it reads red — the same weight the console it unlocks deserves. | 121 |
| `AdminPill` | component | `AdminPill({ locked }: { locked?: boolean })` | 129 |
| `PendingPill` | component | `PendingPill({ expiresAt }: { expiresAt?: string })` | 149 |
| `ExpiredPill` | component | `ExpiredPill()` | 160 |
| `NoAccessPill` | component | `NoAccessPill()` | 169 |
| `RowStatus` | type | Row-level roll-up shown in the STATUS column. | 179 |
| `StatusDot` | component | `StatusDot({ status }: { status: RowStatus })` | 181 |
| `RoleBadge` | component | `RoleBadge({ isOwner }: { isOwner: boolean })` | 197 |
| `StatusChip` | component | `StatusChip({ status, className, }: { status: GrantStatus \| string; cla…)` | 222 |
| `FounderBadge` | component | `FounderBadge({ className }: { className?: string })` | 242 |
| `relativeTime` | function | `relativeTime(iso?: string)` | 256 |

## Interfaces

- **Timers / queues:** `setInterval` at L101

## Dependencies

- **Internal:**
  - `lib/utils.ts` — `cn`
  - `lib/rbac-api.ts` — `formatTimeLeft`, `formatTimeLeftShort`, `GrantStatus`, `ModuleKey`
- **Packages:**
  - `react` — `useEffect`, `useState`
  - `lucide-react` — `Boxes`, `Briefcase`, `Crown`, `GraduationCap`, `Lock`, `Package`, …

## Used by

- `components/dashboard/teamAccess/AccessAuditLog.tsx`
- `components/dashboard/teamAccess/AccessInboxModal.tsx`
- `components/dashboard/teamAccess/InvitePeopleDialog.tsx`
- `components/dashboard/teamAccess/MemberAccessSheet.tsx`
- `components/dashboard/teamAccess/TeamAccessPage.tsx`
