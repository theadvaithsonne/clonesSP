# `lib/rbac-api.ts`

> Module RBAC client — talks to the backend `/rbac` routes.

**Kind:** frontend library · **Lines:** 489

<!-- docgen:auto -->

## Purpose
Module RBAC client — talks to the backend `/rbac` routes.

Two rules drive every call in here (see `RBAC_API.md`):
  1. A grant is an *offer*. `POST /rbac/grants` creates a pending grant with a
     24h expiry; the member's access only turns on when they accept it.
  2. A revoke is an *act*. `DELETE .../permissions/:module` applies instantly
     and cancels any live offer for that module.

The shared `api()` helper flattens error bodies to a message string, but the
grant lifecycle needs the machine-readable `code` (`GRANT_EXPIRED`,
`GRANT_NOT_PENDING`, `SELF_ASSIGN`, …) to render the right recovery UI, so
this module wraps `fetch` directly and throws `RbacError` instead.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `ModuleKey` | type | Module keys are server-owned — never hardcode them, read `/rbac/modules`. | 23 |
| `RbacModule` | type |  | 25 |
| `ModulePermissions` | type | Binary per module: `true` = module admin, `false` = no access. | 28 |
| `PendingGrantCell` | type |  | 30 |
| `MemberRow` | type |  | 32 |
| `MembersResponse` | type |  | 47 |
| `GrantStatus` | type |  | 56 |
| `GrantHistoryEntry` | type |  | 64 |
| `MemberDetail` | type |  | 77 |
| `MyPermissions` | type |  | 79 |
| `MyGrant` | type |  | 88 |
| `CreateGrantsResult` | type |  | 104 |
| `BulkGrantsResult` | type |  | 115 |
| `AuditResponse` | type |  | 126 |
| `RbacError` | class | `extends Error` | 138 |
| `currentOrgId` | function | `currentOrgId(): string \| null` — Every founder endpoint is org-scoped. | 204 |
| `fetchModules` | function | `async fetchModules(): Promise<RbacModule[]>` | 222 |
| `fetchMyPermissions` | function | `async fetchMyPermissions(orgId?: string \| null): Promise<MyPermissions>` | 231 |
| `fetchMyGrants` | function | `async fetchMyGrants(orgId?: string \| null): Promise<MyGrant[]>` | 236 |
| `acceptGrant` | function | `async acceptGrant(grantId: string)` | 244 |
| `declineGrant` | function | `async declineGrant(grantId: string)` | 251 |
| `fetchMembers` | function | `async fetchMembers(params: { orgId?: string \| null; search?: string; module?: …): Promise<MembersResponse>` | 262 |
| `fetchMemberDetail` | function | `async fetchMemberDetail(userId: string, orgId?: string \| null): Promise<MemberDetail>` | 285 |
| `fetchAllMembers` | function | `async fetchAllMembers(orgId?: string \| null): Promise<{ rows: MemberRow[]; modules: RbacModule[…` — Every member in one array. | 305 |
| `createGrants` | function | `async createGrants(userId: string, modules: ModuleKey[], orgId?: string \| null): Promise<CreateGrantsResult>` | 331 |
| `createBulkGrants` | function | `async createBulkGrants(userIds: string[], modules: ModuleKey[], orgId?: string \| null): Promise<BulkGrantsResult>` | 343 |
| `resendGrant` | function | `async resendGrant(grantId: string, orgId?: string \| null)` — Restarts the 24h clock — and revives an expired grant. | 356 |
| `cancelGrant` | function | `async cancelGrant(grantId: string, orgId?: string \| null)` — Withdraw an unanswered offer → `cancelled`. | 365 |
| `revokeModule` | function | `async revokeModule(userId: string, module: ModuleKey, orgId?: string \| null)` | 377 |
| `revokeAllModules` | function | `async revokeAllModules(userId: string, orgId?: string \| null)` | 389 |
| `fetchAuditTrail` | function | `async fetchAuditTrail(params: { orgId?: string \| null; status?: GrantStatus; acti…): Promise<AuditResponse>` | 401 |
| `RBAC_CHANGED_EVENT` | const | `= "rbac:changed"` — Anything that changes permissions or the pending queue fires this so the sidebar, the inbox badge and the founder table all re-read without being wired to each other. | 433 |
| `notifyRbacChanged` | function | `notifyRbacChanged()` | 435 |
| `isExpired` | function | `isExpired(expiresAt?: string \| null): boolean` | 445 |
| `isValidEmail` | function | `isValidEmail(value: string): boolean` | 453 |
| `hasAnyAccess` | function | `hasAnyAccess(row: MemberRow): boolean` — A row counts as "has access" if it holds a module or has a live offer. | 458 |
| `formatTimeLeft` | function | `formatTimeLeft(expiresAt?: string \| null): string` — "23h 12m left" / "48m left" / "Expired" — for the 24h offer countdown. | 466 |
| `formatTimeLeftShort` | function | `formatTimeLeftShort(expiresAt?: string \| null): string` — "23h left" / "48m left" — the compact form that fits inside a table pill. | 479 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/api.ts` — `API_URL`
  - `lib/auth.ts` — `getToken`, `getOrgId`, `getUserDataFromToken`
- **Packages:** none

## Used by

- `components/dashboard/teamAccess/AccessAuditLog.tsx`
- `components/dashboard/teamAccess/AccessInboxModal.tsx`
- `components/dashboard/teamAccess/InvitePeopleDialog.tsx`
- `components/dashboard/teamAccess/MemberAccessSheet.tsx`
- `components/dashboard/teamAccess/TeamAccessPage.tsx`
- `components/dashboard/teamAccess/shared.tsx`
- `lib/hooks/useModuleAccess.ts`
- `lib/hooks/useMyGrants.ts`
