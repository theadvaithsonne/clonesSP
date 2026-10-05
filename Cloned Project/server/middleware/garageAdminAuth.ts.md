# `server/middleware/garageAdminAuth.ts`

> Authentication and page-level RBAC for the Garage admin back-office. It verifies admin JWTs, enforces forced sign-outs, gates each admin path by page permission, and enforces the "Verify your admin" step-up gate.

**Kind:** Express middleware · **Lines:** 308 · **Mounted at:** `/garage-admin`, `/ai-providers`, `/coworking-bookings/admin`, `/whitelabel-addon/admin`, `/cryptosub-addon/admin` (as gates; browser: `/backend/garage-admin`, `/backend/ai-providers`, `/backend/coworking-bookings/admin`, `/backend/whitelabel-addon/admin`, `/backend/cryptosub-addon/admin`)

## Purpose
The admin console (the `garage-admin` frontend, also served on the admin domain through `middleware.ts`) authenticates with its own JWT. That token carries a `garageAdminId` claim instead of a `userId`. This file is the security core for those routes:
- It turns the token into `req.garageAdmin`.
- It decides, per request path and HTTP method, whether that admin's per-page permissions (`view` or `manage`, plus action grants) allow the call.
- It blocks admins who have not yet answered their step-up security question in the current session.

## How it works

### Loading the admin (`loadGarageAdmin`, L38-L67; private)
- It needs an `Authorization: Bearer <token>` header and verifies it with `jwt.verify(token, env.JWT_SECRET)`. Admin and user tokens share this secret.
- It requires `decoded.garageAdminId`, then loads `GarageAdminModel.findById(...).select("+verification")`. Selecting the normally hidden verification state here saves a second query later.
- It rejects admins that are missing or have `isActive: false`.
- **Forced sign-out:** if the admin has a `sessionsInvalidatedAt` and the token's `iat` (in seconds) is older than it, the token is dead. The comparison is made in whole seconds, so a login in the same second as the invalidation is not caught.
- Any failure returns `null`, and the caller chooses the status code.

### Attaching the context (`attach`, L76-L99; private)
`req.garageAdmin` is set to:
- `id`, `name`, `role` and `email`;
- `isSuperAdmin`, true when the role is `"garage-super-admin"`;
- `permissions`, from `resolvePagePermissions(pagePermissions, pagePermissionsSet)`. Admins created before page permissions existed (`pagePermissionsSet` falsy) get the legacy default map.
- `gated`, from `isGated(verification)`. This is true when `ADMIN_VERIFY_ENFORCE` is not `"off"` and the admin has seeded questions.
- `verified`, from the token's `adminVerified` claim. Only `POST /garage-admin/verify` mints that claim, by re-signing the token, so the question is asked once per login.

Permissions are read from the database on every request rather than baked into the JWT, so a revocation takes effect on the admin's next call.

### Per-route authentication
- **`requireGarageAdminAuth`** (L101-L122): if `req.garageAdmin` is already set (because the mount-level gate ran), it goes straight to `next()`. This keeps around 60 existing per-route call sites unchanged and saves a duplicate database read. Otherwise it loads and attaches the admin, returning **401** `Admin not found or inactive` or `Invalid token`.
- **`requireGarageSuperAdmin`** (L124-L133): returns **403** unless the role is `garage-super-admin`.

### Mount-level page gate (`garageAdminPageGate`, L148-L205)
1. It rebuilds the full path as `req.baseUrl + req.path` and calls `resolveAdminPath(fullPath, method)` from `config/adminPages.ts`. The verdict is one of `public`, `any-admin`, `super-only` or `page` (`{ pages, level, action }`).
2. `public` paths (such as login and OTP) pass without authentication.
3. Every other path loads and attaches the admin, returning 401 on failure.
4. Super admins always pass. `any-admin` passes for any authenticated admin. `super-only` returns 403.
5. For `page`, the request passes when `permissionsSatisfy(permissions, pages, level, action)` is true. The level comes from the method (reads need `view`, writes need `manage`). A write that names an action passes with `manage` on the page or with that specific action grant.
6. On failure it returns **403** with `{ error, page, pages, required, held }`. `held` is the best level held across the candidate pages (ranked by `rankLevel`). The error says "You have read-only access to this section" when the admin holds `view` but `manage` was required.

The gate is **deny-by-default**: `resolveAdminPath` returns `super-only` for any path that matches no rule. A new admin route therefore stays super-admin-only until someone maps it in `config/adminPages.ts`.

### Per-route permission guards (for endpoints outside a gated prefix)
These assume `requireGarageAdminAuth` already ran. Each returns 401 when there is no context, and super admins always pass.
- `requireAdminPage(page, level = "view")` is shorthand for `requireAnyAdminPage([page], level)`.
- `requireAnyAdminPage(pages, level)` passes if `levelSatisfies` is true on any of the pages.
- `requireAdminAction(pages, action)` passes with `manage` on any page, or with the action grant (via `permissionsSatisfy`).

### Step-up verification (`requireAdminVerified`, L284-L307)
This is chained after the page gate on every admin prefix. It passes in these cases:
- there is no admin on the request (a public route);
- the admin is not gated;
- the token is already `verified`;
- the path is `/garage-admin/profile` or `/garage-admin/admin-pages`. These two are exempt so the console shell and sidebar can render behind the verification overlay.

Everything else returns **403** `{ code: "ADMIN_VERIFICATION_REQUIRED" }`, which the console's overlay keys off. Without this server-side check the blur overlay would be only cosmetic, since the token in localStorage could call the APIs directly.

## Exports
- `interface GarageAdminRequest` - an Express `Request` with an optional `garageAdmin: { id, name, role, email, isSuperAdmin, permissions, gated, verified }`.
- `requireGarageAdminAuth(req, res, next)` - authenticates an admin token, or skips if already authenticated.
- `requireGarageSuperAdmin(req, res, next)` - super admin only.
- `garageAdminPageGate(req, res, next)` - the mount-level, path-mapped permission gate.
- `requireAdminPage(page, level?)` - per-route guard for a single page.
- `requireAnyAdminPage(pages, level?)` - per-route guard that accepts any of several pages.
- `requireAdminAction(pages, action)` - per-route guard for a write action.
- `requireAdminVerified(req, res, next)` - the step-up verification gate.

## Interfaces
- **Database:** `GarageAdminModel` (`server/models/garageAdmin.model.ts`) - read, including the `+verification` field.
- **Environment variables:** `JWT_SECRET` (through `config/env.ts`); `ADMIN_VERIFY_ENFORCE`, read in `services/adminVerification.ts` (`"off"` disables the gate; the default is `"on"`).
- **Endpoints served:** none of its own. It wraps every route under the five mount prefixes listed above.

## Dependencies
- **Internal:**
  - `server/config/adminPages.ts` - `resolveAdminPath`, `permissionsSatisfy`, `levelSatisfies`, `resolvePagePermissions` and `AdminPageLevel`.
  - `server/services/adminVerification.ts` - `isGated`.
  - `server/models/garageAdmin.model.ts` - the admin documents.
  - `server/config/env.ts` - `JWT_SECRET`.
- **Packages:** `express`, `jsonwebtoken`.

## Used by
- `server/app.ts` mounts `garageAdminPageGate` and `requireAdminVerified` with `app.use(...)` on the five prefixes listed above.
- Per-route imports come from `server/controllers/aiProviderKey.controller.ts` and many routers: `adminCouponRules`, `adminNotifications`, `aiProviders`, `auth`, `coworkingSpace`, `coworkingSpaceBooking`, `cryptosubAddon`, `garageAdmin`, `garageAdminAffiliateGuests`, `garageAdminAnalytics`, `garageAdminAnnouncements`, `garageAdminAuctionSettlements`, `garageAdminCoupons`, `garageAdminCryptosubMonthlyBonus`, `garageAdminDailyReports`, `garageAdminDangerZone`, `garageAdminFounderSubMonthlyBonus`, `garageAdminIgniteCall`, `garageAdminNetworkChainSubs`, `garageAdminOneTimeAffiliates`, `garageAdminOrgCategories`, `garageAdminOrgKyc` and `garageAdminRankBonus`.
- In total, 38 files import it (13 more beyond those listed).

## Notes
- This file is security-sensitive. Any new admin endpoint under a gated prefix must be mapped in `config/adminPages.ts`, or only super admins can use it. An endpoint outside those prefixes is not gated at all unless it uses `requireGarageAdminAuth` plus a per-route guard.
- `middleware/userOrGarageAdmin.ts` also accepts admin tokens but does **not** apply the `isActive`, sign-out cutoff, page-permission or verification checks described here.
