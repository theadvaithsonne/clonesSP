# `server/routes/platformCouponValidation.ts`

> Express router with 1 endpoint, mounted at `/checkout`.

**Kind:** Express router · **Lines:** 103 · **Mounted at:** `/checkout` (browser: `/backend/checkout`)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (1)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| POST | `/validate-platform-coupon` | `/backend/checkout/validate-platform-coupon` | `softAuth` | inline | 47 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 102 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `server/services/platformCoupon.ts` — `validatePlatformCoupon`
  - `server/services/jwt.ts` — `verifyJwt`
- **Packages:**
  - `express` — `Router`, `Request`, `Response`, `NextFunction`
  - `zod` — `z`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/checkout`.
