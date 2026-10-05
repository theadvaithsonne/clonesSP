# `lib/hooks/useMyGrants.ts`

> Member side of the 24-hour grant lifecycle: the offers waiting on me, and the two answers I can give.

**Kind:** React hook · **Lines:** 176 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
Member side of the 24-hour grant lifecycle: the offers waiting on me, and
the two answers I can give.

Accepting is the moment access actually turns on, so both answers finish by
firing `RBAC_CHANGED_EVENT` — that is what makes the sidebar unlock the
module's console without a reload.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

**Hooks used:** `useState`×4, `useCallback`×4, `useEffect`×3, `useRef`×2

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `useMyGrants` | hook | `useMyGrants(options: { orgId?: string \| null; poll?: boolean } = {})` | 33 |

## Interfaces

- **Timers / queues:** `setInterval` at L102

## Dependencies

- **Internal:**
  - `lib/rbac-api.ts` — `acceptGrant`, `declineGrant`, `fetchMyGrants`, `isExpired`, `notifyRbacChanged`, `RbacError`, `RBAC_CHANGED_EVENT`, `MyGrant`
  - `lib/auth.ts` — `getToken`
- **Packages:**
  - `react` — `useCallback`, `useEffect`, `useRef`, `useState`
  - `sonner` — `toast`

## Used by

- `components/dashboard/teamAccess/AccessInboxModal.tsx`
