# `server/routes/adminCouponRules.ts`

> Express router with 6 endpoints, mounted at `/garage-admin/coupon-rules`.

**Kind:** Express router · **Lines:** 343 · **Mounted at:** `/garage-admin/coupon-rules`, `/garage-admin/coupon-rule-items` (browser: `/backend/garage-admin/coupon-rules`, `/backend/garage-admin/coupon-rule-items`)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (6)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| GET | `/` | `/backend/garage-admin/coupon-rules` | `requireGarageAdminAuth` | inline | 116 |
| POST | `/` | `/backend/garage-admin/coupon-rules` | `requireGarageAdminAuth` | inline | 132 |
| GET | `/:id` | `/backend/garage-admin/coupon-rules/:id` | `requireGarageAdminAuth` | inline | 169 |
| PATCH | `/:id` | `/backend/garage-admin/coupon-rules/:id` | `requireGarageAdminAuth` | inline | 187 |
| DELETE | `/:id` | `/backend/garage-admin/coupon-rules/:id` | `requireGarageAdminAuth` | inline | 211 |
| GET | `/all` | `/backend/garage-admin/coupon-rules/all` | `requireGarageAdminAuth` | inline | 255 |

The router is also mounted at `/garage-admin/coupon-rule-items`; every path above exists under each mount.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 227 |
| `adminCouponRuleItemsRouter` | const | `= Router()` | 233 |

## Interfaces

- **Database (Mongoose models used):**
  - `OfficePlan` (server/models/officePlan.model.ts) — reads: `findById`, `find`
  - `UnilevelPlusPlan` (server/models/unilevelPlusPlan.model.ts) — reads: `findById`, `find`
  - `ThirdPartyClient` (server/models/thirdPartyClient.model.ts) — reads: `findById`, `find`
  - `PlatformCoupon` (server/models/platformCoupon.model.ts) — reads: `findById`

## Dependencies

- **Internal:**
  - `server/middleware/garageAdminAuth.ts` — `requireGarageAdminAuth`, `GarageAdminRequest`
  - `server/services/couponRule.ts` — `createCouponRule`, `listCouponRules`, `getCouponRule`, `updateCouponRule`, `deleteCouponRule`
  - `server/models/platformCoupon.model.ts` — `PlatformCoupon`
  - `server/models/officePlan.model.ts` — `OfficePlan`
  - `server/models/unilevelPlusPlan.model.ts` — `UnilevelPlusPlan`
  - `server/models/thirdPartyClient.model.ts` — `ThirdPartyClient`
- **Packages:**
  - `express` — `Router`, `Response`
  - `mongoose` — `Types`
  - `zod` — `z`, `ZodError`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/garage-admin/coupon-rules`, `/garage-admin/coupon-rule-items`.
