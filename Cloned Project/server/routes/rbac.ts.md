# `server/routes/rbac.ts`

> Express router with 14 endpoints, mounted at `/rbac`.

**Kind:** Express router · **Lines:** 908 · **Mounted at:** `/rbac` (browser: `/backend/rbac`)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (14)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| GET | `/modules` | `/backend/rbac/modules` | `requireAuth` | inline | 71 |
| GET | `/me` | `/backend/rbac/me` | `requireAuth` | inline | 84 |
| GET | `/my-grants` | `/backend/rbac/my-grants` | `requireAuth` | inline | 129 |
| POST | `/grants/:grantId/accept` | `/backend/rbac/grants/:grantId/accept` | `requireAuth` | inline | 208 |
| POST | `/grants/:grantId/decline` | `/backend/rbac/grants/:grantId/decline` | `requireAuth` | inline | 232 |
| GET | `/members` | `/backend/rbac/members` | `requireAuth`, `requireOrgAdmin` | inline | 266 |
| GET | `/members/:userId` | `/backend/rbac/members/:userId` | `requireAuth`, `requireOrgAdmin` | inline | 378 |
| POST | `/grants` | `/backend/rbac/grants` | `requireAuth`, `requireOrgAdmin` | inline | 457 |
| POST | `/grants/bulk` | `/backend/rbac/grants/bulk` | `requireAuth`, `requireOrgAdmin` | inline | 548 |
| POST | `/grants/:grantId/resend` | `/backend/rbac/grants/:grantId/resend` | `requireAuth`, `requireOrgAdmin` | inline | 605 |
| DELETE | `/grants/:grantId` | `/backend/rbac/grants/:grantId` | `requireAuth`, `requireOrgAdmin` | inline | 663 |
| DELETE | `/members/:userId/permissions/:module` | `/backend/rbac/members/:userId/permissions/:module` | `requireAuth`, `requireOrgAdmin` | inline | 737 |
| DELETE | `/members/:userId/permissions` | `/backend/rbac/members/:userId/permissions` | `requireAuth`, `requireOrgAdmin` | inline | 776 |
| GET | `/grants` | `/backend/rbac/grants` | `requireAuth`, `requireOrgAdmin` | inline | 822 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 907 |

## Interfaces

- **Database (Mongoose models used):**
  - `User` (server/models/user.model.ts) — reads: `findById`, `find`
  - `PermissionGrant` (server/models/permissionGrant.model.ts) — reads: `countDocuments`, `find`, `findById`, `findOne`

## Dependencies

- **Internal:**
  - `server/middleware/auth.ts` — `requireAuth`
  - `server/middleware/roles.ts` — `requireOrgAdmin`
  - `server/models/user.model.ts` — `User`
  - `server/models/permissionGrant.model.ts` — `PermissionGrant`
  - `server/config/rbacModules.ts` — `GRANT_TTL_MS`, `MODULE_LABELS`, `RBAC_MODULES`, `RbacModule`, `isRbacModule`
  - `server/utils/rbac.ts` — `findMembership`, `isAssignable`, `normalizePermissions`, `sanitizeModuleList`, `OrgMembershipLike`
  - `server/utils/accessCheck.ts` — `hasFounderAccess`
  - `server/utils/http.ts` — `ok`, `fail`
  - `server/services/permissionGrant.ts` — `acceptGrant`, `createGrants`, `declineGrant`, `expireIfLapsed`, `findLiveGrants`, `revokeModules`
- **Packages:**
  - `express` — `Router`, `Request`, `Response`
  - `mongoose` — `Types`
  - `zod` — `z`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/rbac`.
