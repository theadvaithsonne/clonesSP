# `server/config/rbacModules.ts`

> The list of product modules a founder can delegate admin control of to members, plus helpers for validating and initialising module permissions.

**Kind:** backend config · **Lines:** 44

## Purpose
Module-level RBAC lets a founder make a non-founder, non-guest member an admin of individual product surfaces. Access is binary per module (admin or not; no viewer/editor tiers). This file is the catalogue the routes, validation, permission model and middleware are all driven from. It is separate from garage-admin page RBAC (`config/adminPages.ts`), which governs the platform back-office.

## How it works
- `RBAC_MODULES = ["community", "courses", "live_streams", "digital_products"]`, with display names in `MODULE_LABELS` (Community, Courses, Live Streams, Digital Products).
- `GRANT_TTL_MS` = 24 hours: a pending grant the member never accepts or declines expires after this. `services/permissionGrant.ts` and `routes/rbac.ts` stamp `expiresAt` with it.
- `isRbacModule(value)` is a type guard used to reject unknown module names.
- `emptyPermissions()` returns a fresh `{ module: false }` map each call, so no caller can mutate a shared object.
- Adding a module takes three edits: `RBAC_MODULES`, `MODULE_LABELS`, and the boolean in the `modulePermissions` sub-schema in `models/user.model.ts`.

## Exports
- `RBAC_MODULES` - readonly tuple of module keys.
- `type RbacModule` - union of those keys.
- `MODULE_LABELS: Record<RbacModule, string>` - display names.
- `GRANT_TTL_MS` - pending-grant lifetime in ms (86,400,000).
- `isRbacModule(value: unknown): value is RbacModule`.
- `emptyPermissions(): Record<RbacModule, boolean>` - all modules off.

## Interfaces
- **Endpoints that use it:** the founder RBAC routes in `routes/rbac.ts` (mounted at `/rbac`, browser `/backend/rbac/...`) list modules with labels and validate module names.

## Dependencies
None.

## Used by
- `server/middleware/auth.ts`, `server/middleware/rbac.ts` - permission checks.
- `server/models/permissionGrant.model.ts` - module enum for grants.
- `server/routes/rbac.ts` - grant / revoke / list endpoints.
- `server/services/permissionGrant.ts` - grant lifecycle and expiry.
- `server/utils/rbac.ts` - helpers.

## Notes
- Forgetting the `user.model.ts` sub-schema field when adding a module means the permission can be granted but never saved on the user.
