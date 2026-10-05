# `components/garage-admin/admin-search.tsx`

> React component `AdminSearchProvider`.

**Kind:** React component · **Lines:** 39 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `AdminSearchContext` (local)

### Props

- **`AdminSearchProvider`**: `children: React.ReactNode`

**Hooks used:** `useState`, `usePathname` (next/navigation), `useEffect`, `useContext`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `AdminSearchProvider` | component | `AdminSearchProvider({ children }: { children: React.ReactNode })` | 20 |
| `useAdminSearch` | hook | `useAdminSearch(): AdminSearchCtx` — Read the shared header search. | 36 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:** none
- **Packages:**
  - `react` — `createContext`, `useContext`, `useEffect`, `useState`
  - `next` — `usePathname`

## Used by

- `app/garage-admin/(admin-dashboard)/affiliate-guests/page.tsx`
- `app/garage-admin/(admin-dashboard)/coupons/page.tsx`
- `app/garage-admin/(admin-dashboard)/daily-reports/page.tsx`
- `app/garage-admin/(admin-dashboard)/founders/page.tsx`
- `app/garage-admin/(admin-dashboard)/invitees/page.tsx`
- `app/garage-admin/(admin-dashboard)/layout.tsx`
- `app/garage-admin/(admin-dashboard)/networkchain-subs/page.tsx`
- `app/garage-admin/(admin-dashboard)/networkchains/axons/page.tsx`
- `app/garage-admin/(admin-dashboard)/networkchains/meet/live/page.tsx`
- `app/garage-admin/(admin-dashboard)/networkchains/offerings/page.tsx`
- `app/garage-admin/(admin-dashboard)/networkchains/posthog/page.tsx`
- `app/garage-admin/(admin-dashboard)/networkchains/sentry/page.tsx`
- `app/garage-admin/(admin-dashboard)/networkchains/subscriptions/page.tsx`
- `app/garage-admin/(admin-dashboard)/networkchains/users/page.tsx`
- `app/garage-admin/(admin-dashboard)/notifications/page.tsx`
- `app/garage-admin/(admin-dashboard)/one-time-affiliates/page.tsx`
- `app/garage-admin/(admin-dashboard)/organizations/page.tsx`
- `app/garage-admin/(admin-dashboard)/platform-coupons/page.tsx`
- `app/garage-admin/(admin-dashboard)/platform-fees/page.tsx`
- `app/garage-admin/(admin-dashboard)/rank-bonus/page.tsx`
- `app/garage-admin/(admin-dashboard)/stakeholders/page.tsx`
- `app/garage-admin/(admin-dashboard)/tickets/page.tsx`
- `app/garage-admin/(admin-dashboard)/unilevel-plus-licenses/page.tsx`
- `app/garage-admin/(admin-dashboard)/user-wallets/page.tsx`
- `app/garage-admin/(admin-dashboard)/users/page.tsx`
- _…and 3 more_
