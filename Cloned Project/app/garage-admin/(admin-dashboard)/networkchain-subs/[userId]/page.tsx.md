# `app/garage-admin/(admin-dashboard)/networkchain-subs/[userId]/page.tsx`

> NetworkChain Subs profile route — thin wrapper.

**Kind:** Next.js page · **Lines:** 17 · **Directive:** `"use client"` · **Route:** `/garage-admin/networkchain-subs/[userId]` (page)

<!-- docgen:auto -->

## Purpose
NetworkChain Subs profile route — thin wrapper. All behavior lives in the
shared MemberProfileView (components/garage-admin/member-profile-view.tsx),
which is also rendered by the One Time Affiliates and Users profile routes.
Only the breadcrumb label differs per list.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `MemberProfileView` (components/garage-admin/member-profile-view.tsx)

### Props

- **`NetworkChainSubProfilePage`**: `params: Promise<{ userId: string }>`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (NetworkChainSubProfilePage)` | component | `NetworkChainSubProfilePage({ params, }: { params: Promise<{ userId: string }>; })` | 10 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/garage-admin/member-profile-view.tsx` — `MemberProfileView`
- **Packages:** none

## Used by

Entry: reached by the Next.js router at `/garage-admin/networkchain-subs/[userId]` (page).
