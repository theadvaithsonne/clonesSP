# `server/routes/founderPlatformCoupons.ts`

> Express router with 10 endpoints, mounted at `/org/:orgId/platform-coupons`.

**Kind:** Express router · **Lines:** 458 · **Mounted at:** `/org/:orgId/platform-coupons` (browser: `/backend/org/:orgId/platform-coupons`)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (10)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| GET | `/` | `/backend/org/:orgId/platform-coupons` | `requireAuth`, `requireFounder` | inline | 193 |
| POST | `/` | `/backend/org/:orgId/platform-coupons` | `requireAuth`, `requireFounder` | inline | 212 |
| GET | `/:id` | `/backend/org/:orgId/platform-coupons/:id` | `requireAuth`, `requireFounder` | inline | 257 |
| PATCH | `/:id` | `/backend/org/:orgId/platform-coupons/:id` | `requireAuth`, `requireFounder` | inline | 274 |
| POST | `/:id/deactivate` | `/backend/org/:orgId/platform-coupons/:id/deactivate` | `requireAuth`, `requireFounder` | inline | 301 |
| POST | `/:id/activate` | `/backend/org/:orgId/platform-coupons/:id/activate` | `requireAuth`, `requireFounder` | inline | 318 |
| GET | `/:id/redemptions` | `/backend/org/:orgId/platform-coupons/:id/redemptions` | `requireAuth`, `requireFounder` | inline | 335 |
| GET | `/:id/assignments` | `/backend/org/:orgId/platform-coupons/:id/assignments` | `requireAuth`, `requireFounder` | inline | 353 |
| POST | `/:id/assignments` | `/backend/org/:orgId/platform-coupons/:id/assignments` | `requireAuth`, `requireFounder` | inline | 378 |
| DELETE | `/:id/assignments/:assignmentId` | `/backend/org/:orgId/platform-coupons/:id/assignments/:assignmentId` | `requireAuth`, `requireFounder` | inline | 430 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 457 |

## Interfaces

- **Database (Mongoose models used):**
  - `Channel` (server/models/channel.model.ts) — reads: `findOne`
  - `Course` (server/models/course.model.ts) — reads: `findOne`
  - `Workshop` (server/models/workshop.model.ts) — reads: `findOne`
  - `Product` (server/models/product.model.ts) — reads: `findOne`
  - `User` (server/models/user.model.ts) — reads: `findById`
  - `PlatformCoupon` (server/models/platformCoupon.model.ts) — reads: `findById`

## Dependencies

- **Internal:**
  - `server/middleware/auth.ts` — `requireAuth`, `AuthRequest`
  - `server/utils/accessCheck.ts` — `hasFounderAccess`
  - `server/models/user.model.ts` — `User`
  - `server/services/platformCoupon.ts` — `createPlatformCoupon`, `updatePlatformCoupon`, `deactivatePlatformCoupon`, `activatePlatformCoupon`, `listPlatformCoupons`, `getPlatformCouponById`, `listRedemptionsForCoupon`
  - `server/models/platformCoupon.model.ts` — `PlatformCoupon`
  - `server/models/channel.model.ts` — `Channel`
  - `server/models/course.model.ts` — `Course`
  - `server/models/workshop.model.ts` — `Workshop`
  - `server/models/product.model.ts` — `Product`
- **Packages:**
  - `express` — `Router`, `Request`, `Response`, `NextFunction`
  - `zod` — `z`, `ZodError`
  - `mongoose` — `Types`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/org/:orgId/platform-coupons`.
