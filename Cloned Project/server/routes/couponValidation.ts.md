# `server/routes/couponValidation.ts`

> src/routes/couponValidation.ts Public endpoint for validating coupons at checkout

**Kind:** Express router · **Lines:** 73 · **Mounted at:** `/checkout` (browser: `/backend/checkout`)

<!-- docgen:auto -->

## Purpose
src/routes/couponValidation.ts
Public endpoint for validating coupons at checkout

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (1)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| POST | `/validate-coupon` | `/backend/checkout/validate-coupon` | — | inline | 23 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 72 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `server/services/coupon.ts` — `validateCoupon`
  - `server/models/coupon.model.ts` — `ApplicableItemType`
- **Packages:**
  - `express` — `Router`, `Request`, `Response`
  - `zod` — `z`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/checkout`.
