# `server/services/permissionGrant.ts`

> Module exporting `expireIfLapsed`, `findLiveGrants`, `createGrants`, `acceptGrant` and 2 more.

**Kind:** backend service · **Lines:** 282

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `SkipReason` | type | Grant lifecycle for module-level RBAC. | 24 |
| `Skipped` | interface |  | 30 |
| `expireIfLapsed` | function | `async expireIfLapsed(grant: any): Promise<boolean>` — Flip a pending grant whose clock ran out. | 43 |
| `findLiveGrants` | function | `async findLiveGrants(orgId: string, userIds: string[])` — Pending, unexpired grants for a set of members in one org. | 54 |
| `createGrants` | function | `async createGrants(params: { orgId: string; targetUserId: string; modules: Rba…): Promise<{ created: any[]; existing: any[]; skippe…` — Offer `modules` to one member. | 101 |
| `acceptGrant` | function | `async acceptGrant(grant: any): Promise<void>` — Member accepted — write the permission and close the grant. | 206 |
| `declineGrant` | function | `async declineGrant(grant: any): Promise<void>` — Member declined — nothing changes except the grant's status. | 225 |
| `revokeModules` | function | `async revokeModules(params: { orgId: string; targetUserId: string; modules: Rba…): Promise<{ revoked: RbacModule[]; cancelled: numbe…` — Take `modules` away from a member — immediately, with no acceptance step. | 237 |

## Interfaces

- **Database (Mongoose models used):**
  - `PermissionGrant` (server/models/permissionGrant.model.ts) — reads: `find`, `findOne`; **writes:** `create`, `updateMany`, `insertMany`
  - `UserNotification` (server/models/userNotification.model.ts) — **writes:** `create`
  - `User` (server/models/user.model.ts) — reads: `findById`; **writes:** `updateOne`

## Dependencies

- **Internal:**
  - `server/models/permissionGrant.model.ts` — `PermissionGrant`
  - `server/models/userNotification.model.ts` — `UserNotification`
  - `server/models/user.model.ts` — `User`
  - `server/config/rbacModules.ts` — `GRANT_TTL_MS`, `MODULE_LABELS`, `RbacModule`
  - `server/utils/rbac.ts` — `findMembership`, `isAssignable`, `normalizePermissions`, `OrgMembershipLike`
- **Packages:** none

## Used by

- `server/routes/rbac.ts`
