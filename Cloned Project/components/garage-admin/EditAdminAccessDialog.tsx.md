# `components/garage-admin/EditAdminAccessDialog.tsx`

> Change one admin's role label and per-page access after the fact.

**Kind:** React component · **Lines:** 166 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
Change one admin's role label and per-page access after the fact.
Super-admin only — the endpoint behind it (PATCH
/garage-admin/admins/:id/access) rejects everyone else, and refuses to
touch a super admin's row at all.

Changes take effect on the admin's next request: the backend gate reads
permissions off the document per request rather than out of the JWT, so
nobody has to log out and back in.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Button`×2 (components/ui/button.tsx), `Dialog` (components/ui/dialog.tsx), `DialogTrigger` (components/ui/dialog.tsx), `DialogContent` (components/ui/dialog.tsx), `DialogHeader` (components/ui/dialog.tsx), `DialogTitle` (components/ui/dialog.tsx), `AdminAccessMatrix` (components/garage-admin/AdminAccessMatrix.tsx)

### Props

- **`EditAdminAccessDialog`**: `admin: { id: string; name: string; email: string; role: string; permi…`, `onSaved?: () => void`, `children: React.ReactNode`

**Hooks used:** `useState`×6, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (EditAdminAccessDialog)` | component | `EditAdminAccessDialog({ admin, onSaved, children, }: { admin: { id: string; name:…)` | 34 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/ui/button.tsx` — `Button`
  - `components/ui/dialog.tsx` — `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogTrigger`
  - `lib/utils.ts` — `cn`
  - `components/garage-admin/AdminAccessMatrix.tsx` — `AdminAccessMatrix (default)`
  - `lib/admin-api/permissions.ts` — `getAdminPageCatalogue`, `getAdminRolesInUse`, `updateAdminAccess`, `emptyPermissions`, `AdminPageCatalogue`, `AdminPageLevel`, `AdminRoleInUse`
- **Packages:**
  - `react` — `useEffect`, `useState`
  - `sonner` — `toast`

## Used by

- `app/garage-admin/(admin-dashboard)/roles/page.tsx`
