# `server/routes/garageAdminCoupons.ts`

> Express router with 7 endpoints, mounted at `/garage-admin/coupons`.

**Kind:** Express router · **Lines:** 371 · **Mounted at:** `/garage-admin/coupons` (browser: `/backend/garage-admin/coupons`)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (7)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| GET | `/available-items` | `/backend/garage-admin/coupons/available-items` | `requireGarageAdminAuth` | inline | 87 |
| POST | `/` | `/backend/garage-admin/coupons` | `requireGarageAdminAuth` | inline | 123 |
| GET | `/` | `/backend/garage-admin/coupons` | `requireGarageAdminAuth` | inline | 173 |
| GET | `/:id` | `/backend/garage-admin/coupons/:id` | `requireGarageAdminAuth` | inline | 219 |
| PATCH | `/:id` | `/backend/garage-admin/coupons/:id` | `requireGarageAdminAuth` | inline | 248 |
| DELETE | `/:id` | `/backend/garage-admin/coupons/:id` | `requireGarageAdminAuth` | inline | 309 |
| GET | `/:id/analytics` | `/backend/garage-admin/coupons/:id/analytics` | `requireGarageAdminAuth` | inline | 339 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 370 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `server/middleware/garageAdminAuth.ts` — `requireGarageAdminAuth`, `GarageAdminRequest`
  - `server/services/coupon.ts` — `createCoupon`, `updateCoupon`, `deactivateCoupon`, `getCouponById`, `listCoupons`, `getCouponAnalytics`, `listItemsByCategory`
  - `server/models/coupon.model.ts` — `ApplicableItemType`
- **Packages:**
  - `express` — `Router`, `Response`
  - `zod` — `z`, `ZodError`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/garage-admin/coupons`.
