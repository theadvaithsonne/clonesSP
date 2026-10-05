# `server/middleware/rbac.ts`

> Module-level RBAC guards that gate a route on admin rights for one product module, plus a boolean helper and a legacy role guard.

**Kind:** Express middleware · **Lines:** 127

## Purpose
Founders can delegate admin rights for individual product modules (`community`, `courses`, `live_streams`, `digital_products`, from `config/rbacModules.ts`) to org members. The guards here let a route require "admin of courses" instead of "founder". Founders, and stakeholders holding the legacy `fullAccess` flag, always pass. Replacing `requireFounder` with `requireModuleAdmin("courses")` on a route therefore only widens access: nobody loses it. The header comment says these guards are **not yet applied to any route**. Converting routes is planned follow-up work, one module at a time.

## How it works
- **`resolveOrgId(req)`** (private) picks the org being acted on: `req.query.orgId` first (the codebase-wide convention), then `req.params.orgId`, then `req.user.orgId`.
- **`resolveMembership(req, orgId)`** (private) returns the caller's `organizations[]` entry for that org. When the org is the token's org, it reuses the `req.membership` that `requireAuth` attached, so no query is needed. For a cross-org request, it loads `User.findById(...).select("organizations")` and calls `findMembership`.
- **`requireModuleAdmin(module)`** returns async middleware that must run after `requireAuth`. It responds:
  - **401** with no user;
  - **400** with no resolvable org;
  - **403** `{ code: "MODULE_ACCESS_REQUIRED", module }` when `isModuleAdmin(membership, module)` is false;
  - **500** on errors.

  `isModuleAdmin` returns true for founder or `fullAccess` holders, and otherwise reads the normalized `modulePermissions[module]`.
- **`canModule(req, module)`** is a synchronous boolean version for handlers that branch on access, for example to hide fields. It only uses `req.membership`, so it is valid for the token's own org only.
- **`requireAnyRole(roles)`** is a legacy guard. It maps `admin` to `founder` and returns 403 `Forbidden` unless `req.user.role` is in `roles`.

## Exports
- `requireModuleAdmin(module: RbacModule)` - middleware factory that requires module-admin rights for the org in scope.
- `canModule(req, module): boolean` - non-blocking check for the token's own org.
- `requireAnyRole(roles: string[])` - legacy role allow-list guard.

## Interfaces
- **Database:** `User` - reads `organizations`, only for cross-org checks.

## Dependencies
- **Internal:**
  - `server/utils/rbac.ts` - `findMembership`, `isModuleAdmin` and `OrgMembershipLike`.
  - `server/models/user.model.ts` - `User`.
  - `server/config/rbacModules.ts` - the `RbacModule` type.
- **Packages:** `express`.

## Used by
Nothing imports this file today; it appears unused, which matches its own comment. `server/middleware/auth.ts` and `server/utils/rbac.ts` refer readers to it in comments.

## Notes
- Because the query parameter wins, a client can point `?orgId=` at another org. The membership is then looked up for that org, which is the correct behaviour: access is checked against the org actually being acted on, not the token's org.
