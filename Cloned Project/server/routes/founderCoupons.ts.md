# `server/routes/founderCoupons.ts`

> Express router with 7 endpoints, mounted at `/org`.

**Kind:** Express router · **Lines:** 391 · **Mounted at:** `/org` (browser: `/backend/org`)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (7)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| GET | `/:orgId/coupons/available-items` | `/backend/org/:orgId/coupons/available-items` | `requireAuth`, `requireFounder` | inline | 112 |
| POST | `/:orgId/coupons` | `/backend/org/:orgId/coupons` | `requireAuth`, `requireFounder` | inline | 146 |
| GET | `/:orgId/coupons` | `/backend/org/:orgId/coupons` | `requireAuth`, `requireFounder` | inline | 193 |
| GET | `/:orgId/coupons/:couponId` | `/backend/org/:orgId/coupons/:couponId` | `requireAuth`, `requireFounder` | inline | 225 |
| PATCH | `/:orgId/coupons/:couponId` | `/backend/org/:orgId/coupons/:couponId` | `requireAuth`, `requireFounder` | inline | 265 |
| DELETE | `/:orgId/coupons/:couponId` | `/backend/org/:orgId/coupons/:couponId` | `requireAuth`, `requireFounder` | inline | 321 |
| GET | `/:orgId/coupons/:couponId/analytics` | `/backend/org/:orgId/coupons/:couponId/analytics` | `requireAuth`, `requireFounder` | inline | 356 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 390 |

## Interfaces

- **Database (Mongoose models used):**
  - `User` (server/models/user.model.ts) — reads: `findById`

## Dependencies

- **Internal:**
  - `server/middleware/auth.ts` — `requireAuth`, `AuthRequest`
  - `server/utils/accessCheck.ts` — `hasFounderAccess`
  - `server/models/user.model.ts` — `User`
  - `server/services/coupon.ts` — `createCoupon`, `updateCoupon`, `deactivateCoupon`, `getCouponById`, `listCoupons`, `getCouponAnalytics`, `listItemsByCategory`
  - `server/models/coupon.model.ts` — `ApplicableItemType`
- **Packages:**
  - `express` — `Router`, `Request`, `Response`, `NextFunction`
  - `zod` — `z`, `ZodError`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/org`.
