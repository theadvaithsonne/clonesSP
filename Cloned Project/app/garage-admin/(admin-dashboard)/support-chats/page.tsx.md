# `app/garage-admin/(admin-dashboard)/support-chats/page.tsx`

> Support Chats — Admin → Others → Support Chats.

**Kind:** Next.js page · **Lines:** 17 · **Directive:** `"use client"` · **Route:** `/garage-admin/support-chats` (page)

<!-- docgen:auto -->

## Purpose
Support Chats — Admin → Others → Support Chats.

Every member has one support chat; every active admin is a participant and
replies as their own app user. No page permission is required (the sidebar
entry is marked everyAdmin), so the only gates are the shared admin session
and step-up verification, both handled by the layout and the API.

Backend: garagenew-backend routes/garageAdminSupportChats.ts.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `SupportChatsConsole` (components/garage-admin/SupportChatsConsole.tsx)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (SupportChatsPage)` | component | `SupportChatsPage()` | 14 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/garage-admin/SupportChatsConsole.tsx` — `SupportChatsConsole (default)`
- **Packages:** none

## Used by

Entry: reached by the Next.js router at `/garage-admin/support-chats` (page).
