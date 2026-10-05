# `server/utils/rbac.ts`

> Module exporting `findMembership`, `normalizePermissions`, `isModuleAdmin`, `isAssignable` and 2 more.

**Kind:** backend utility · **Lines:** 134

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `OrgMembershipLike` | interface | The shape of a single entry in `user.organizations[]`. | 13 |
| `findMembership` | function | `findMembership(memberships: T[] \| null \| undefined, orgId: string \| null \| undefined): T \| null` — Locate a user's membership in a given org. | 22 |
| `normalizePermissions` | function | `normalizePermissions(membership: OrgMembershipLike \| null \| undefined): Record<RbacModule, boolean>` — Read a membership's module permissions as a complete, all-keys-present map. | 41 |
| `isModuleAdmin` | function | `isModuleAdmin(membership: OrgMembershipLike \| null \| undefined, module: RbacModule): boolean` — Is this membership an admin of `module`? | 62 |
| `isAssignable` | function | `isAssignable(membership: OrgMembershipLike \| null \| undefined): boolean` — Can a founder assign module permissions to this membership? | 77 |
| `sanitizeModuleList` | function | `sanitizeModuleList(input: unknown): RbacModule[]` — Filter arbitrary input down to known modules, de-duplicated. | 85 |
| `isFounderOrModuleAdmin` | function | `async isFounderOrModuleAdmin(userId: string, orgId: string, module: RbacModule): Promise<boolean>` — "Can this user manage `module` in this org?" — the retrofit entry point for the per-file `isUserFounder(userId, orgId)` helpers in the module route files (course.ts, product.ts, feed.ts, workshop.ts). | 104 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `server/config/rbacModules.ts` — `RBAC_MODULES`, `RbacModule`, `emptyPermissions`, `isRbacModule`
  - `server/utils/accessCheck.ts` — `hasFounderAccess`
- **Packages:** none

## Used by

- `server/middleware/auth.ts`
- `server/middleware/rbac.ts`
- `server/routes/auth.ts`
- `server/routes/course.ts`
- `server/routes/feed.ts`
- `server/routes/product.ts`
- `server/routes/rbac.ts`
- `server/routes/webinarRoutes.ts`
- `server/routes/workshop.ts`
- `server/services/eventManagement.ts`
- `server/services/jobs.ts`
- `server/services/permissionGrant.ts`
- `server/services/webinarHost.ts`
