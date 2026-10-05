# `server/middleware/roles.ts`

> Org role guards (admin, org admin, founder, org founder) that check either the role on `req.user` or the caller's org membership in the database.

**Kind:** Express middleware · **Lines:** 130

## Purpose
This is the older family of role-based guards. Some trust the role that `requireAuth` already resolved. Others re-check the `User` document against an explicit `orgId` from the query or URL, so a user cannot act on an org just by holding a token whose role is founder in some other org. Each guard must run after `requireAuth`.

## How it works
- **`requireAdmin`** passes when `req.user.role` is `"admin"` (legacy) or `"founder"`. Otherwise it returns **403** `Admin only`.
- **`requireOrgAdmin`** (async) reads `orgId` from **`req.query`**:
  - It returns 400 if `orgId` is missing.
  - It loads `User.findById(userId).select("role organization organizations")`.
  - It passes when either the legacy single `organization` equals `orgId` and the global role is admin or founder, or the `organizations[]` entry for `orgId` satisfies `hasFounderAccess` (founder or `fullAccess`).
  - Otherwise it returns **403** `Admin only`, or 401 for a missing user and 500 on errors.
- **`requireFounder`** passes only when `req.user.role === "founder"`. Otherwise it returns **403** `Founder only`.
- **`requireOrgFounder`** (async) is the same database check as `requireOrgAdmin`, but it reads `orgId` from **`req.params`**. It returns 400 `Organization ID required in URL`, 401 `User not found`, or 403 `Only founders can perform this action`. Errors are logged with a `[requireOrgFounder]` prefix.

## Exports
- `requireAdmin(req, res, next)` - role check against `req.user` (admin or founder).
- `requireOrgAdmin(req, res, next)` - database membership check for `?orgId=`.
- `requireFounder(req, res, next)` - role check against `req.user` (founder only).
- `requireOrgFounder(req, res, next)` - database membership check for `:orgId`.

## Interfaces
- **Database:** `User` - reads `role organization organizations`.

## Dependencies
- **Internal:**
  - `server/models/user.model.ts` - `User`.
  - `server/utils/accessCheck.ts` - `hasFounderAccess`.
- **Packages:** `express`. `mongoose` is imported for `Types`, which is never used.

## Used by
- `server/routes/invites.ts`, `server/routes/rbac.ts` and `server/routes/wallet.ts` use `requireOrgAdmin`.
- `server/routes/membership.ts` uses `requireOrgFounder`.

## Notes
- `requireFounder` duplicates `requireFounder` in `middleware/auth.ts`. Only the error message differs.
- "Org admin" here really means founder-level access. The check is the same as for `requireOrgFounder`; only where `orgId` comes from differs.
