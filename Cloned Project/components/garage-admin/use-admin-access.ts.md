# `components/garage-admin/use-admin-access.ts`

> What the signed-in garage admin is allowed to do, for hiding controls they can't use.

**Kind:** React component · **Lines:** 68 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
What the signed-in garage admin is allowed to do, for hiding controls
they can't use. The API gate is the enforcement — this is about not
showing someone a Delete button that will only ever answer 403.

Read through the hook rather than localStorage directly: the value is
resolved in an effect so the server render and the first client render
agree (reading localStorage during render would make them differ).

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

**Hooks used:** `useState`, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `AdminAccess` | type |  | 19 |
| `useAdminAccess` | hook | `useAdminAccess(): AdminAccess` | 32 |

## Interfaces

- **Browser storage / cookies:** `garage_admin_info` (localStorage: get)

## Dependencies

- **Internal:**
  - `lib/admin-api/permissions.ts` — `LEGACY_ADMIN_PERMISSIONS`, `canDoActionWith`, `levelSatisfies`, `AdminPageLevel`
- **Packages:**
  - `react` — `useEffect`, `useState`

## Used by

- `app/garage-admin/(admin-dashboard)/affiliate-guests/page.tsx`
- `app/garage-admin/(admin-dashboard)/ai-providers/page.tsx`
- `app/garage-admin/(admin-dashboard)/categories/page.tsx`
- `app/garage-admin/(admin-dashboard)/companies/page.tsx`
- `app/garage-admin/(admin-dashboard)/coupons/page.tsx`
- `app/garage-admin/(admin-dashboard)/coworking-spaces/page.tsx`
- `app/garage-admin/(admin-dashboard)/cryptobrand-offices/[orgId]/users/[userId]/page.tsx`
- `app/garage-admin/(admin-dashboard)/daily-reports/page.tsx`
- `app/garage-admin/(admin-dashboard)/networkchain-subs/page.tsx`
- `app/garage-admin/(admin-dashboard)/networkchains/axons/[axonId]/page.tsx`
- `app/garage-admin/(admin-dashboard)/networkchains/funnels/[id]/page.tsx`
- `app/garage-admin/(admin-dashboard)/networkchains/funnels/page.tsx`
- `app/garage-admin/(admin-dashboard)/networkchains/meet/live/page.tsx`
- `app/garage-admin/(admin-dashboard)/networkchains/subscriptions/page.tsx`
- `app/garage-admin/(admin-dashboard)/networkchains/users/[userId]/page.tsx`
- `app/garage-admin/(admin-dashboard)/notifications/page.tsx`
- `app/garage-admin/(admin-dashboard)/one-time-affiliates/page.tsx`
- `app/garage-admin/(admin-dashboard)/organizations/page.tsx`
- `app/garage-admin/(admin-dashboard)/platform-coupons/page.tsx`
- `app/garage-admin/(admin-dashboard)/tickets/page.tsx`
- `app/garage-admin/(admin-dashboard)/users/page.tsx`
- `components/garage-admin/AnnouncementsConsole.tsx`
- `components/garage-admin/SupportAgentDashboard.tsx`
- `components/garage-admin/SupportTaskroomPicker.tsx`
- `components/garage-admin/member-profile-view.tsx`
