# `server/models/permissionGrant.model.ts`

> Mongoose model that is both the queue of pending module-permission offers (founder to member) and the permanent audit trail of grants and revokes.

**Kind:** Mongoose model · **Lines:** 84

## Purpose
Founders can give office members access to modules (from `RBAC_MODULES` in `server/config/rbacModules.ts`: `community`, `courses`, `live_streams`, `digital_products`). Granting does not hand over access directly: it writes a row here with `action: "grant"`, `status: "pending"` and a 24-hour expiry, and the member must accept before `user.organizations[].modulePermissions[module]` flips to `true`. Revokes are asymmetric - nobody has to accept losing access - so they apply to the membership immediately and are recorded here as `action: "revoke"`, `status: "applied"` purely for the audit trail.

## How it works
- **Fields:**
  - `orgId` (ref `Organization`) and `userId` (ref `User`, the member) - required, indexed.
  - `module` - enum `RBAC_MODULES`.
  - `action` - `"grant"` or `"revoke"`.
  - `status` - `pending` (awaiting the member), `accepted` (live), `declined`, `expired` (24h elapsed with no response), `cancelled` (founder withdrew before a response), `applied` (revokes only).
  - `grantedBy` (ref `User`, required) - the founder who acted.
  - `expiresAt` - grants only; absent on revokes.
  - `respondedAt` - when the member accepted/declined or the sweeper expired it.
  - `timestamps: true`.
- **Rows are never deleted** (no TTL index). Expiry flips `status`, so the history of who granted what, and whether it was taken up, survives.
- **Indexes:**
  - Unique `{ orgId, userId, module }` with `partialFilterExpression: { status: "pending" }` - at most one live offer per member and module; history rows never collide.
  - `{ orgId, status, createdAt: -1 }` - founder audit log (`GET /rbac/grants?orgId=&status=`).
  - `{ userId, status, createdAt: -1 }` - member inbox (`GET /rbac/my-grants`).
  - `{ status, expiresAt }` - the expiry sweeper.

## Exports
- `PermissionGrant` - the Mongoose model.

## Interfaces
- **Database:** `PermissionGrant` (collection `permissiongrants`).
- **Background work:** `server/index.ts` runs a sweeper at boot and then every 30 minutes: `updateMany({ action: "grant", status: "pending", expiresAt: { $lt: now } }, { $set: { status: "expired", respondedAt: now } })`.

## Dependencies
- **Internal:** `server/config/rbacModules.ts` - `RBAC_MODULES`, the allowed module names (that file also defines `GRANT_TTL_MS`, the 24h window).
- **Packages:** `mongoose`.

## Used by
- `server/services/permissionGrant.ts` - `expireIfLapsed`, `findLiveGrants`, `createGrants`, `acceptGrant`, `declineGrant`, `revokeModules`.
- `server/routes/rbac.ts` - mounted at `/rbac` (browser `/backend/rbac/...`).
- `server/index.ts` - the expiry sweeper (dynamic import).

## Notes
- Adding a module to `RBAC_MODULES` automatically widens this schema's enum; the user model's `modulePermissions` sub-schema must be updated too (per the comment in `rbacModules.ts`).
- Because the sweeper runs only every 30 minutes, `expireIfLapsed` in the service also checks expiry on read, so a lapsed offer cannot be accepted in the gap.
