# `lib/admin-api/permissions.ts`

> Client-side page-level RBAC for garage admins: the page catalogue and role-template API calls, plus helpers that compare permission levels, check write actions, and choose where an admin lands after login.

**Kind:** frontend library · **Lines:** 241

## Purpose
Garage admins are either super admins or delegated admins. A delegated admin holds a map of page keys to levels (`none` / `view` / `manage`), with optional per-action grants. The backend file `server/config/adminPages.ts` is the source of truth for the page list, and this module fetches it rather than duplicating it. As a result, a page added on the backend shows up in the access grids with no frontend change. Every UI check here is only about **not showing people doors they cannot open**. The backend gate (`garageAdminPageGate` in `server/app.ts`) is what enforces access, and it denies any unmapped `/garage-admin` path unless the admin is a super admin.

A key rule, repeated from the source: **a super admin is not a set of permissions.** Nothing a super admin can do is expressed as a page level, so no role built in this UI can reach a super-admin-only area.

## How it works
- **Catalogue.** `getAdminPageCatalogue()` returns:
  - `levels`;
  - `groupLabels`;
  - `pages` (`key`, `label`, `group`, `manageHint?`, `href?`, `actions?`);
  - `presets` (named role templates with a permission map).
- **Action keys.** A page may define independent write actions. Their grants live in the same map under the key `"<page>:<action>"`, built by `actionKey()`. `canDoActionWith(perms, page, action)` is true when the page level is `manage` (which covers every action) or that action key is `manage`, mirroring the backend's `permissionsSatisfy` for writes. `countGranted()` counts only page keys (keys without `:`), so action grants do not inflate the "N of M granted" figure.
- **Levels.** `levelSatisfies(held, required)`:
  - `none` is always satisfied;
  - `view` needs `view` or `manage`;
  - `manage` needs `manage`.
  `LEVEL_LABELS` holds the display text, and `emptyPermissions(pages)` builds an all-`none` map.
- **Roles.** Roles used to be inferred from the admins holding them, so a role name typed into the invite dialog disappeared on refresh unless an invite was sent. Roles are now stored definitions:
  - `getAdminRolesInUse()` lists them with `adminCount`;
  - `createAdminRole(name, permissions)` defines one;
  - `updateAdminRole(name, { newName?, permissions? })` renames or changes the template;
  - `deleteAdminRole(name)` removes the definition.
  Editing or deleting a definition **does not change admins who already hold the label**, because each admin's access is stored on their own document. `updateAdminAccess(adminId, { role?, permissions? })` changes one admin's access.
- **Legacy fallback.** `LEGACY_ADMIN_PERMISSIONS` gives `view` on users, founders, stakeholders, organizations and unilevel_plus_licenses. It mirrors the backend constant of the same name and is used when a cached `garage_admin_info` was written before permissions existed, which avoids an empty sidebar until the profile is fetched again.
- **Landing page.** `landingPathForAdmin(info)`:
  - a super admin (`isSuperAdmin` or role `garage-super-admin`) goes to `SUPER_ADMIN_LANDING` (`/garage-admin/analytics/traction`);
  - anyone else goes to the first catalogue page with an `href` they can view;
  - if there is none, or the catalogue fetch fails, they go to `/garage-admin/roles`, which shows a clear "super admin only" notice.
- **`isSuperAdminClient()`** reads `localStorage.garage_admin_info` and checks the role or the `isSuperAdmin` flag. It is only used to hide controls.

## Exports
- Types: `AdminPageLevel`, `AdminPageAction`, `AdminPage`, `AdminRolePreset`, `AdminPageCatalogue`, `AdminRoleInUse`.
- `actionKey(page, action): string` - `"page:action"`.
- `LEGACY_ADMIN_PERMISSIONS`, `LEVEL_LABELS`, `SUPER_ADMIN_LANDING` - constants.
- `getAdminPageCatalogue(): Promise<AdminPageCatalogue>`
- `getAdminRolesInUse(): Promise<AdminRoleInUse[]>`
- `createAdminRole(name, permissions)`, `updateAdminRole(name, changes)`, `deleteAdminRole(name)` - role definitions.
- `updateAdminAccess(adminId, body)` - sets one admin's role and permissions.
- `emptyPermissions(pages)`, `levelSatisfies(held, required)`, `countGranted(permissions)`, `canDoActionWith(permissions, page, action)` - pure helpers.
- `landingPathForAdmin(info): Promise<string>` - where to go after login.
- `isSuperAdminClient(): boolean` - super-admin check from the cached info.

## Interfaces
- **Backend endpoints called** (`server/routes/garageAdmin.ts`, mounted at `/garage-admin`):
  - `GET /backend/garage-admin/admin-pages` - any authenticated admin
  - `GET /backend/garage-admin/admin-roles` - super admin
  - `POST /backend/garage-admin/admin-roles` - super admin
  - `PATCH /backend/garage-admin/admin-roles/:name` - super admin
  - `DELETE /backend/garage-admin/admin-roles/:name` - super admin
  - `PATCH /backend/garage-admin/admins/:id/access` - super admin, because handing this out would let a delegated admin widen their own access
- **Browser storage / cookies:** reads `localStorage.garage_admin_info`.

## Dependencies
- **Internal:** `lib/api.ts` - `garageAdminApi`.

## Used by
- `app/garage-admin/(admin-dashboard)/companies/page.tsx`, `app/garage-admin/(admin-dashboard)/layout.tsx`, `app/garage-admin/(admin-dashboard)/roles/page.tsx`
- `app/garage-admin/accept-invite/page.tsx`, `app/garage-admin/login/page.tsx`, `app/garage-admin/page.tsx`
- `components/garage-admin/AccessGrid.tsx`, `AdminAccessMatrix.tsx`, `EditAdminAccessDialog.tsx`, `IgniteCallDrawer.tsx`, `InviteAdminDialog.tsx`, `ManageRolesDialog.tsx`, `ignite-call.tsx`, `use-admin-access.ts`

## Notes
- Keep `LEGACY_ADMIN_PERMISSIONS` and the `actionKey` format in step with the backend.
