# `app/garage-admin/(admin-dashboard)/announcements/page.tsx`

> Alerts & Promotions — Admin → Others → Alerts & Promotions.

**Kind:** Next.js page · **Lines:** 17 · **Directive:** `"use client"` · **Route:** `/garage-admin/announcements` (page)

<!-- docgen:auto -->

## Purpose
Alerts & Promotions — Admin → Others → Alerts & Promotions.

Authors the dialogs and banners users see pre-login (login/signup) and
post-login (dashboard/workspaces). Super admin only — the sidebar entry is
superOnly, and /garage-admin/announcements is not in the delegatable page
catalogue, so the backend gate is super-admin by default too.

Backend: garagenew-backend routes/garageAdminAnnouncements.ts.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `AnnouncementsConsole` (components/garage-admin/AnnouncementsConsole.tsx)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (AnnouncementsPage)` | component | `AnnouncementsPage()` | 14 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/garage-admin/AnnouncementsConsole.tsx` — `AnnouncementsConsole (default)`
- **Packages:** none

## Used by

Entry: reached by the Next.js router at `/garage-admin/announcements` (page).
