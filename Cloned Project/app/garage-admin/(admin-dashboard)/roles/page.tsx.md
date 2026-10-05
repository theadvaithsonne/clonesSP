# `app/garage-admin/(admin-dashboard)/roles/page.tsx`

> Roles & Access — the one dedicated page for everything role-related: • Admins tab — invite an admin, GIVE them a role + per-action access, edit it later, or deactivate them.

**Kind:** Next.js page · **Lines:** 543 · **Directive:** `"use client"` · **Route:** `/garage-admin/roles` (page)

<!-- docgen:auto -->

## Purpose
Roles & Access — the one dedicated page for everything role-related:
  • Admins tab — invite an admin, GIVE them a role + per-action access,
    edit it later, or deactivate them.
  • Roles tab — define reusable role TEMPLATES (a starting point copied
    into an admin when assigned; editing a template never re-permissions
    admins who already hold it).

Both tabs drive the shared AccessGrid, which now expands pages with
independent write actions (assign agent vs. mark NVC, edit coupon vs.
activate vs. assign, …) into per-action checkboxes. So a grant reads and
behaves identically wherever it's set.

Super-admin only, like everything under Permissions: inviting admins and
defining the roles they can hold are the same trust boundary.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Loader2`×4 (lucide-react), `ShieldCheck`×4 (lucide-react), `Button`×4 (components/ui/button.tsx), `InviteAdminDialog`×2 (components/garage-admin/InviteAdminDialog.tsx), `UserPlus` (lucide-react), `User` (lucide-react), `EditAdminAccessDialog` (components/garage-admin/EditAdminAccessDialog.tsx), `AlertDialog` (components/ui/alert-dialog.tsx), `AlertDialogTrigger` (components/ui/alert-dialog.tsx), `ToggleLeft` (lucide-react), `AlertDialogContent` (components/ui/alert-dialog.tsx), `AlertDialogHeader` (components/ui/alert-dialog.tsx), `AlertDialogTitle` (components/ui/alert-dialog.tsx), `AlertTriangle` (lucide-react), `AlertDialogDescription` (components/ui/alert-dialog.tsx), `AlertDialogFooter` (components/ui/alert-dialog.tsx), `AlertDialogCancel` (components/ui/alert-dialog.tsx), `AlertDialogAction` (components/ui/alert-dialog.tsx), `Plus` (lucide-react), `Users` (lucide-react), `Pencil` (lucide-react), `Trash2` (lucide-react), `Dialog` (components/ui/dialog.tsx), `DialogContent` (components/ui/dialog.tsx), `DialogHeader` (components/ui/dialog.tsx), `DialogTitle` (components/ui/dialog.tsx), `Input` (components/ui/input.tsx), `AccessGrid` (components/garage-admin/AccessGrid.tsx)

**Hooks used:** `useState`×13, `useCallback`×2, `useRouter` (next/navigation), `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (GarageAdminRolesPage)` | component | `GarageAdminRolesPage()` | 97 |

## Interfaces

- **garage-admin API called (`my.revenue.network`):**
  - `GET /garage-admin/admins` (L112)
  - `PATCH /garage-admin/admins/${admin.id}/toggle` (L122)
- **Browser storage / cookies:** `garage_admin_info` (localStorage: get)

## Dependencies

- **Internal:**
  - `lib/api.ts` — `garageAdminApi`
  - `components/ui/dialog.tsx` — `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`
  - `components/ui/alert-dialog.tsx` — `AlertDialog`, `AlertDialogAction`, `AlertDialogCancel`, `AlertDialogContent`, `AlertDialogDescription`, `AlertDialogFooter`, `AlertDialogHeader`, `AlertDialogTitle`, … +1
  - `components/ui/input.tsx` — `Input`
  - `components/ui/button.tsx` — `Button`
  - `components/garage-admin/AccessGrid.tsx` — `AccessGrid (default)`
  - `components/garage-admin/InviteAdminDialog.tsx` — `InviteAdminDialog (default)`
  - `components/garage-admin/EditAdminAccessDialog.tsx` — `EditAdminAccessDialog (default)`
  - `lib/admin-api/permissions.ts` — `getAdminPageCatalogue`, `getAdminRolesInUse`, `createAdminRole`, `updateAdminRole`, `deleteAdminRole`, `emptyPermissions`, `countGranted`, `AdminPageCatalogue`, … +2
- **Packages:**
  - `react` — `useCallback`, `useEffect`, `useState`
  - `next` — `useRouter`
  - `sonner` — `toast`
  - `lucide-react` — `AlertTriangle`, `Crown`, `Loader2`, `Pencil`, `Plus`, `ShieldCheck`, …

## Used by

Entry: reached by the Next.js router at `/garage-admin/roles` (page).
