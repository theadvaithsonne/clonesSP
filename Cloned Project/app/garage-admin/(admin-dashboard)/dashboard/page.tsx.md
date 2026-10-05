# `app/garage-admin/(admin-dashboard)/dashboard/page.tsx`

> Admin management moved into the consolidated Roles & Access page (/garage-admin/roles), which does both defining roles and giving admins a role + per-action access.

**Kind:** Next.js page · **Lines:** 25 · **Directive:** `"use client"` · **Route:** `/garage-admin/dashboard` (page)

<!-- docgen:auto -->

## Purpose
Admin management moved into the consolidated Roles & Access page
(/garage-admin/roles), which does both defining roles and giving admins a
role + per-action access. This route now just forwards there so old
bookmarks, the header brand link and any stale deep links still land in the
right place instead of on a duplicate admin table.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Loader2` (lucide-react)

**Hooks used:** `useRouter` (next/navigation), `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (GarageAdminDashboardRedirect)` | component | `GarageAdminDashboardRedirect()` | 13 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:** none
- **Packages:**
  - `react` — `useEffect`
  - `next` — `useRouter`
  - `lucide-react` — `Loader2`

## Used by

Entry: reached by the Next.js router at `/garage-admin/dashboard` (page).
