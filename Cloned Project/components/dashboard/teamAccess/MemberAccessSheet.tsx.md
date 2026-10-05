# `components/dashboard/teamAccess/MemberAccessSheet.tsx`

> One member's access, plus the audit trail of every grant and revoke that produced it (`GET /rbac/members/:userId` returns the last 100 events).

**Kind:** React component · **Lines:** 360 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
One member's access, plus the audit trail of every grant and revoke that
produced it (`GET /rbac/members/:userId` returns the last 100 events).

Same rules as the table: inviting creates a 24h offer, revoking is instant.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `X`×2 (lucide-react), `Loader2`×2 (lucide-react), `Clock` (lucide-react), `RefreshCw` (lucide-react), `AnimatePresence` (framer-motion), `MemberAvatar` (components/dashboard/teamAccess/shared.tsx), `FounderBadge` (components/dashboard/teamAccess/shared.tsx), `Icon` (local), `ShieldCheck` (lucide-react), `PendingRow` (local), `Send` (lucide-react), `History` (lucide-react), `StatusChip` (components/dashboard/teamAccess/shared.tsx)

### Props

- **`MemberAccessSheet`**: `userId: string | null`, `modules?: RbacModule[]`, `onClose: () => void`, `onChanged?: () => void`

**Hooks used:** `useState`×3, `useCallback`×2, `useEffect`×2, `useCountdown` (components/dashboard/teamAccess/shared.tsx)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (MemberAccessSheet)` | component | `MemberAccessSheet({ userId, modules, onClose, onChanged, }: { userId: string …)` | 82 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/utils.ts` — `cn`
  - `lib/rbac-api.ts` — `cancelGrant`, `createGrants`, `fetchMemberDetail`, `notifyRbacChanged`, `resendGrant`, `revokeModule`, `MemberDetail`, `ModuleKey`, … +2
  - `components/dashboard/teamAccess/shared.tsx` — `FounderBadge`, `MemberAvatar`, `moduleIcon`, `relativeTime`, `StatusChip`, `useCountdown`
- **Packages:**
  - `react` — `useCallback`, `useEffect`, `useState`
  - `framer-motion` — `AnimatePresence`, `motion`
  - `lucide-react` — `Clock`, `History`, `Loader2`, `RefreshCw`, `Send`, `ShieldCheck`, …
  - `sonner` — `toast`

## Used by

- `components/dashboard/teamAccess/TeamAccessPage.tsx`
