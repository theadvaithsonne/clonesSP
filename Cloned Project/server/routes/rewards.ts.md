# `server/routes/rewards.ts`

> Express router with 1 endpoint, mounted at `/checkout`.

**Kind:** Express router · **Lines:** 169 · **Mounted at:** `/checkout` (browser: `/backend/checkout`)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (1)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| GET | `/my-rewards` | `/backend/checkout/my-rewards` | `requireAuth` | inline | 20 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 168 |

## Interfaces

- **Database (Mongoose models used):**
  - `CouponAssignment` (server/models/couponAssignment.model.ts) — reads: `find`; **writes:** `updateMany`
  - `PlatformCoupon` (server/models/platformCoupon.model.ts) — reads: `find`
  - `Coupon` (server/models/coupon.model.ts) — reads: `find`
  - `Organization` (server/models/organization.model.ts) — reads: `find`

## Dependencies

- **Internal:**
  - `server/middleware/auth.ts` — `requireAuth`, `AuthRequest`
  - `server/models/couponAssignment.model.ts` — `CouponAssignment`
  - `server/models/platformCoupon.model.ts` — `PlatformCoupon`
  - `server/models/coupon.model.ts` — `Coupon`
  - `server/models/organization.model.ts` — `Organization`
- **Packages:**
  - `express` — `Router`, `Request`, `Response`
  - `mongoose` — `Types`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/checkout`.
