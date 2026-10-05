# `app/garage-admin/(admin-dashboard)/users/[userId]/page.tsx`

> Users profile route — thin wrapper.

**Kind:** Next.js page · **Lines:** 17 · **Directive:** `"use client"` · **Route:** `/garage-admin/users/[userId]` (page)

<!-- docgen:auto -->

## Purpose
Users profile route — thin wrapper. All behavior lives in the shared
MemberProfileView (components/garage-admin/member-profile-view.tsx), which is
also rendered by the One Time Affiliates and NetworkChain Subs profile
routes. Only the breadcrumb label differs per list.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `MemberProfileView` (components/garage-admin/member-profile-view.tsx)

### Props

- **`UserProfilePage`**: `params: Promise<{ userId: string }>`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (UserProfilePage)` | component | `UserProfilePage({ params, }: { params: Promise<{ userId: string }>; })` | 10 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/garage-admin/member-profile-view.tsx` — `MemberProfileView`
- **Packages:** none

## Used by

Entry: reached by the Next.js router at `/garage-admin/users/[userId]` (page).
