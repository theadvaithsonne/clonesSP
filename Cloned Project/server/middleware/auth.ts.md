# `server/middleware/auth.ts`

> The backend's main user-authentication middleware. It verifies the user JWT, resolves the caller's effective role and module permissions for the current org, and provides soft-auth, founder and internal-key guards.

**Kind:** Express middleware · **Lines:** 151

## Purpose
Almost every user-facing Express route (about 165 importing files) protects itself with `requireAuth` from this file. It turns a bearer token into `req.user`, the identity object that handlers read: `userId`, `orgId`, `role`, `email` and `permissions`. It also defines the shared `AuthUser` and `AuthRequest` types that route handlers use for typing.

## How it works

### `softAuth`: optional identity
- If there is no `Authorization` header, it continues as a guest.
- Otherwise it takes the second space-separated token and runs `verifyJwt` on it. On success it sets `req.user = { userId, orgId, email }` from the token payload alone. On any failure (malformed or expired token) it continues as a guest without an error.
- It does **not** look the user up in the database, so a token for a deleted user still sets `req.user`. Handlers that need certainty must check for themselves. It is meant for public flows, such as public invoice links, that behave differently when a user is signed in.

### `requireAuth`: required identity
1. A missing header returns **401** `{ error: "Missing auth" }`. The token is `header.split(" ")[1]`. The `Bearer` scheme word itself is not checked.
2. `verifyJwt` checks the HS256 token against `JWT_SECRET` (see `services/jwt.ts`). Any failure returns **401** `Invalid token`.
3. Loads the user with `User.findById(payload.userId).select("email role organization organizations").lean()`. If the user does not exist, returns **401** `Invalid user`.
4. **Resolving the org:** `orgId` is the token's `orgId`, or else the user's legacy single `organization`.
5. **Effective role:** it starts with the user's global `role`. If the user has an `organizations[]` membership for `orgId`, the role becomes `"founder"` when `hasFounderAccess(membership)` is true (a real founder, or a stakeholder whose `fullAccess` flag is set). Otherwise it becomes the membership's own role.
6. Sets `req.user = { userId, role, orgId, email, permissions }`, where `permissions = normalizePermissions(membership)`. That is a complete map of the RBAC modules (`community`, `courses`, `live_streams`, `digital_products`) to booleans, with `false` for anything missing.
7. Also sets `req.membership` to the raw membership object, or `null` when the token's org is not one the user belongs to. Module-RBAC checks downstream (`middleware/rbac.ts`) then need no extra query.

### `requireFounder`
It must run after `requireAuth`. It returns 401 if `req.user` is absent and 403 `Founder access required` unless `req.user.role === "founder"`. Because `requireAuth` already turns `fullAccess` stakeholders into `"founder"`, they pass too.

### `requireInternalKey`
Service-to-service authentication for the Agent-Manager service. It returns **503** if `INTERNAL_API_KEY` is unset and **401** if the `x-internal-api-key` header does not match.

## Exports
- `interface AuthUser` - `{ userId; role?; orgId; email?; permissions?: Record<RbacModule, boolean> }`. The comment warns against answering "can they?" from `permissions` directly, because founders bypass the map. Use `requireModuleAdmin` or `canModule` from `middleware/rbac.ts` instead.
- `type AuthRequest` - `Request & { user: AuthUser }`.
- `softAuth(req, res, next): void` - optional JWT identity, with no database lookup.
- `requireAuth(req, res, next): Promise<...>` - required JWT identity with a database lookup and role resolution.
- `requireFounder(req, res, next): void` - requires a founder (or `fullAccess`) role.
- `requireInternalKey(req, res, next): void` - an `X-Internal-Api-Key` gate.

## Interfaces
- **Database:** `User` - read (`email role organization organizations`) once per `requireAuth` call.
- **Environment variables:** `JWT_SECRET`, used indirectly through `services/jwt.ts`; `INTERNAL_API_KEY` for `requireInternalKey`.
- **External services:** Agent-Manager calls the endpoints guarded by `requireInternalKey`.

## Dependencies
- **Internal:**
  - `server/services/jwt.ts` - `verifyJwt`.
  - `server/models/user.model.ts` - `User`.
  - `server/utils/accessCheck.ts` - `hasFounderAccess`.
  - `server/utils/rbac.ts` - `normalizePermissions` and `OrgMembershipLike`.
  - `server/config/rbacModules.ts` - the `RbacModule` type.
- **Packages:** `express`.

## Used by
165 files. Examples:
- the `server/bat246/routes/*` routers: `bat246`, `bat246Layaway`, `bat246LostMoney`, `bat246Permission`, `bat246Profile` and `bat246SnapBackLoan`;
- the note-taker routes: `sessions`, `summaries` and `transcripts`;
- `server/routes/affiliate.ts`, `apps.ts`, `askCabinet.ts`, `auction.ts`, `auth.ts`, `betty.ts`, `bond.ts`, `cabinet.ts`, `calendar.ts`, `call.ts`, `callBooking.ts`, `careers.ts`, `cashbackCodes.ts` and `chat.ts`;
- `server/controllers/downlineOffer.controller.ts` and `garageUniversityOnboarding.controller.ts`;
- and 140 more.

`requireInternalKey` is used by `routes/internalPush.ts`, `unilevel-plus.ts`, `wallet.ts` and `walletHq.ts`.

## Notes
- `requireAuth` hits the database on every request. Role changes therefore take effect immediately, but this costs one `User` read per call.
- `roles.ts` has a second `requireFounder` with a different error text (`"Founder only"`). The two behave the same.
- A `garageAdminId` token signed with the same secret fails `requireAuth` because it has no `userId` (the `User` lookup returns null, giving 401). Use `middleware/userOrGarageAdmin.ts` for routes that both kinds of caller must reach.
