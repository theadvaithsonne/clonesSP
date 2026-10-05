# `server/routes/founderCouponItems.ts`

> Express router with 2 endpoints, mounted at `/org/:orgId/coupon-eligible-items`.

**Kind:** Express router · **Lines:** 428 · **Mounted at:** `/org/:orgId/coupon-eligible-items` (browser: `/backend/org/:orgId/coupon-eligible-items`)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (2)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| GET | `/` | `/backend/org/:orgId/coupon-eligible-items` | `requireAuth`, `requireFounder` | inline | 74 |
| GET | `/all` | `/backend/org/:orgId/coupon-eligible-items/all` | `requireAuth`, `requireFounder` | inline | 261 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 427 |

## Interfaces

- **Database (Mongoose models used):**
  - `User` (server/models/user.model.ts) — reads: `findById`
  - `Channel` (server/models/channel.model.ts) — reads: `find`
  - `Course` (server/models/course.model.ts) — reads: `find`
  - `Workshop` (server/models/workshop.model.ts) — reads: `find`
  - `Product` (server/models/product.model.ts) — reads: `find`
  - `Service` (server/models/service.model.ts) — reads: `find`
  - `CallOffering` (server/models/callOffering.model.ts) — reads: `find`
  - `StoreProduct` (server/models/storeProduct.model.ts) — reads: `find`

## Dependencies

- **Internal:**
  - `server/middleware/auth.ts` — `requireAuth`, `AuthRequest`
  - `server/utils/accessCheck.ts` — `hasFounderAccess`
  - `server/models/user.model.ts` — `User`
  - `server/models/channel.model.ts` — `Channel`
  - `server/models/course.model.ts` — `Course`
  - `server/models/workshop.model.ts` — `Workshop`
  - `server/models/product.model.ts` — `Product`
  - `server/models/service.model.ts` — `Service`
  - `server/models/callOffering.model.ts` — `CallOffering`
  - `server/models/storeProduct.model.ts` — `StoreProduct`
- **Packages:**
  - `express` — `Router`, `Request`, `Response`, `NextFunction`
  - `mongoose` — `Types`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/org/:orgId/coupon-eligible-items`.
