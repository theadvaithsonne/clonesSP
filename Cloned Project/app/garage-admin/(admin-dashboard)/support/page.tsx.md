# `app/garage-admin/(admin-dashboard)/support/page.tsx`

> The Support Agent dashboard route.

**Kind:** Next.js page · **Lines:** 12 · **Directive:** `"use client"` · **Route:** `/garage-admin/support` (page)

<!-- docgen:auto -->

## Purpose
The Support Agent dashboard route. Reached from the "Support Agent" tile in
the dashboard-type pill (which navigates here) or directly. Any authenticated
admin can open it — it only ever shows the affiliates assigned to THEM.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `SupportAgentDashboard` (components/garage-admin/SupportAgentDashboard.tsx)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (GarageAdminSupportPage)` | component | `GarageAdminSupportPage()` | 9 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/garage-admin/SupportAgentDashboard.tsx` — `SupportAgentDashboard (default)`
- **Packages:** none

## Used by

Entry: reached by the Next.js router at `/garage-admin/support` (page).
