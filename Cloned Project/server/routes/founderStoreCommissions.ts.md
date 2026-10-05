# `server/routes/founderStoreCommissions.ts`

> Founder-scoped CRUD + picker helpers for `StoreCouponCommission` — cascading coupon rewards on store (`ecommerce_item`) sales, paid up the buyer's upline chain.

**Kind:** Express router · **Lines:** 329 · **Mounted at:** `/org/:orgId/store-commissions` (browser: `/backend/org/:orgId/store-commissions`)

<!-- docgen:auto -->

## Purpose
Founder-scoped CRUD + picker helpers for
`StoreCouponCommission` — cascading coupon rewards on store
(`ecommerce_item`) sales, paid up the buyer's upline chain.
Mounted at /org/:orgId/store-commissions.

Auth: requireAuth + requireFounder (mirrors founderCouponRules.ts).

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (7)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| GET | `/` | `/backend/org/:orgId/store-commissions` | `requireAuth`, `requireFounder` | inline | 188 |
| GET | `/available-coupons` | `/backend/org/:orgId/store-commissions/available-coupons` | `requireAuth`, `requireFounder` | inline | 203 |
| GET | `/available-store-products` | `/backend/org/:orgId/store-commissions/available-store-products` | `requireAuth`, `requireFounder` | inline | 221 |
| POST | `/` | `/backend/org/:orgId/store-commissions` | `requireAuth`, `requireFounder` | inline | 241 |
| GET | `/:id` | `/backend/org/:orgId/store-commissions/:id` | `requireAuth`, `requireFounder` | inline | 269 |
| PATCH | `/:id` | `/backend/org/:orgId/store-commissions/:id` | `requireAuth`, `requireFounder` | inline | 285 |
| DELETE | `/:id` | `/backend/org/:orgId/store-commissions/:id` | `requireAuth`, `requireFounder` | inline | 314 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 328 |

## Interfaces

- **Database (Mongoose models used):**
  - `User` (server/models/user.model.ts) — reads: `findById`
  - `PlatformCoupon` (server/models/platformCoupon.model.ts) — reads: `find`
  - `StoreProduct` (server/models/storeProduct.model.ts) — reads: `findById`

## Dependencies

- **Internal:**
  - `server/middleware/auth.ts` — `requireAuth`, `AuthRequest`
  - `server/utils/accessCheck.ts` — `hasFounderAccess`
  - `server/models/user.model.ts` — `User`
  - `server/models/platformCoupon.model.ts` — `PlatformCoupon`
  - `server/models/storeProduct.model.ts` — `StoreProduct`
  - `server/models/storeCouponCommission.model.ts` — `MAX_STORE_COMMISSION_LEVELS`
  - `server/services/storeCouponCommission.ts` — `createStoreCommission`, `listStoreCommissions`, `getStoreCommission`, `updateStoreCommission`, `deleteStoreCommission`, `listAvailableUnlimitedCoupons`, `listOrgStoreProducts`
- **Packages:**
  - `express` — `Router`, `Request`, `Response`, `NextFunction`
  - `mongoose` — `Types`
  - `zod` — `z`, `ZodError`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/org/:orgId/store-commissions`.
