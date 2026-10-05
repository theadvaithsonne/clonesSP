# `server/routes/founderCouponRules.ts`

> Express router with 5 endpoints, mounted at `/org/:orgId/coupon-rules`.

**Kind:** Express router · **Lines:** 332 · **Mounted at:** `/org/:orgId/coupon-rules` (browser: `/backend/org/:orgId/coupon-rules`)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (5)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| GET | `/` | `/backend/org/:orgId/coupon-rules` | `requireAuth`, `requireFounder` | inline | 214 |
| POST | `/` | `/backend/org/:orgId/coupon-rules` | `requireAuth`, `requireFounder` | inline | 232 |
| PATCH | `/:id` | `/backend/org/:orgId/coupon-rules/:id` | `requireAuth`, `requireFounder` | inline | 267 |
| DELETE | `/:id` | `/backend/org/:orgId/coupon-rules/:id` | `requireAuth`, `requireFounder` | inline | 293 |
| GET | `/:id` | `/backend/org/:orgId/coupon-rules/:id` | `requireAuth`, `requireFounder` | inline | 312 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 331 |

## Interfaces

- **Database (Mongoose models used):**
  - `User` (server/models/user.model.ts) — reads: `findById`
  - `Channel` (server/models/channel.model.ts) — reads: `findOne`
  - `Course` (server/models/course.model.ts) — reads: `findOne`
  - `Workshop` (server/models/workshop.model.ts) — reads: `findOne`
  - `Product` (server/models/product.model.ts) — reads: `findOne`
  - `Service` (server/models/service.model.ts) — reads: `findOne`
  - `CallOffering` (server/models/callOffering.model.ts) — reads: `findOne`
  - `StoreProduct` (server/models/storeProduct.model.ts) — reads: `findOne`
  - `PlatformCoupon` (server/models/platformCoupon.model.ts) — reads: `findById`

## Dependencies

- **Internal:**
  - `server/middleware/auth.ts` — `requireAuth`, `AuthRequest`
  - `server/utils/accessCheck.ts` — `hasFounderAccess`
  - `server/models/user.model.ts` — `User`
  - `server/models/platformCoupon.model.ts` — `PlatformCoupon`
  - `server/models/channel.model.ts` — `Channel`
  - `server/models/course.model.ts` — `Course`
  - `server/models/workshop.model.ts` — `Workshop`
  - `server/models/product.model.ts` — `Product`
  - `server/models/service.model.ts` — `Service`
  - `server/models/callOffering.model.ts` — `CallOffering`
  - `server/models/storeProduct.model.ts` — `StoreProduct`
  - `server/services/couponRule.ts` — `createCouponRule`, `listCouponRules`, `getCouponRule`, `updateCouponRule`, `deleteCouponRule`
- **Packages:**
  - `express` — `Router`, `Request`, `Response`, `NextFunction`
  - `mongoose` — `Types`
  - `zod` — `z`, `ZodError`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/org/:orgId/coupon-rules`.
