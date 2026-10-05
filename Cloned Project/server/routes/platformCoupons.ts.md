# `server/routes/platformCoupons.ts`

> Express router with 10 endpoints, mounted at `/garage-admin/platform-coupons`.

**Kind:** Express router · **Lines:** 330 · **Mounted at:** `/garage-admin/platform-coupons` (browser: `/backend/garage-admin/platform-coupons`)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (10)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| GET | `/` | `/backend/garage-admin/platform-coupons` | `requireGarageAdminAuth` | inline | 79 |
| POST | `/` | `/backend/garage-admin/platform-coupons` | `requireGarageAdminAuth` | inline | 119 |
| GET | `/:id` | `/backend/garage-admin/platform-coupons/:id` | `requireGarageAdminAuth` | inline | 147 |
| PATCH | `/:id` | `/backend/garage-admin/platform-coupons/:id` | `requireGarageAdminAuth` | inline | 162 |
| POST | `/:id/deactivate` | `/backend/garage-admin/platform-coupons/:id/deactivate` | `requireGarageAdminAuth` | inline | 186 |
| POST | `/:id/activate` | `/backend/garage-admin/platform-coupons/:id/activate` | `requireGarageAdminAuth` | inline | 201 |
| GET | `/:id/redemptions` | `/backend/garage-admin/platform-coupons/:id/redemptions` | `requireGarageAdminAuth` | inline | 216 |
| GET | `/:id/assignments` | `/backend/garage-admin/platform-coupons/:id/assignments` | `requireGarageAdminAuth` | inline | 231 |
| POST | `/:id/assignments` | `/backend/garage-admin/platform-coupons/:id/assignments` | `requireGarageAdminAuth` | inline | 253 |
| DELETE | `/assignments/:assignmentId` | `/backend/garage-admin/platform-coupons/assignments/:assignmentId` | `requireGarageAdminAuth` | inline | 306 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 329 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `server/middleware/garageAdminAuth.ts` — `requireGarageAdminAuth`, `GarageAdminRequest`
  - `server/services/platformCoupon.ts` — `createPlatformCoupon`, `updatePlatformCoupon`, `deactivatePlatformCoupon`, `activatePlatformCoupon`, `listPlatformCoupons`, `getPlatformCouponById`, `listRedemptionsForCoupon`
- **Packages:**
  - `express` — `Router`, `Response`
  - `zod` — `z`, `ZodError`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/garage-admin/platform-coupons`.
