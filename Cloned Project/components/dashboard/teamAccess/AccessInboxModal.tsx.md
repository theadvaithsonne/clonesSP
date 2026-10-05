# `components/dashboard/teamAccess/AccessInboxModal.tsx`

> Member side of Team & Access: the offers waiting on me.

**Kind:** React component · **Lines:** 254 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
Member side of Team & Access: the offers waiting on me.

This is where the 24-hour lifecycle actually resolves — accepting here is the
moment `modulePermissions[module]` flips to `true` and the module's admin
console unlocks in the sidebar.

Mounted once in the dashboard layout. It opens when:
  - a `rbac:open-inbox` event fires (notification click, sidebar badge), or
  - a new offer arrives that this browser session hasn't shown yet.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Loader2`×2 (lucide-react), `AnimatePresence`×2 (framer-motion), `Icon` (local), `MemberAvatar` (components/dashboard/teamAccess/shared.tsx), `Clock` (lucide-react), `Check` (lucide-react), `KeyRound` (lucide-react), `X` (lucide-react), `GrantCard` (local)

**Hooks used:** `useEffect`×4, `useCountdown` (components/dashboard/teamAccess/shared.tsx), `useState`, `useMyGrants` (lib/hooks/useMyGrants.ts), `useMemo`, `useCallback`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `OPEN_ACCESS_INBOX_EVENT` | const | `= "rbac:open-inbox"` | 23 |
| `openAccessInbox` | function | `openAccessInbox()` — Fire from anywhere to pop the inbox (notification row, sidebar badge, …). | 26 |
| `default (AccessInboxModal)` | component | `AccessInboxModal()` | 138 |

## Interfaces

- **Timers / queues:** `setTimeout` at L163

## Dependencies

- **Internal:**
  - `lib/utils.ts` — `cn`
  - `lib/hooks/useMyGrants.ts` — `useMyGrants`
  - `components/dashboard/teamAccess/shared.tsx` — `MemberAvatar`, `moduleIcon`, `useCountdown`
  - `lib/rbac-api.ts` — `MyGrant`, `(types only)`
- **Packages:**
  - `react` — `useCallback`, `useEffect`, `useMemo`, `useState`
  - `framer-motion` — `AnimatePresence`, `motion`
  - `lucide-react` — `Check`, `Clock`, `KeyRound`, `Loader2`, `X`

## Used by

- `app/(dashboard)/layout.tsx`
- `components/dashboard/MainSidebar.tsx`
- `components/dashboard/NotificationPage.tsx`
