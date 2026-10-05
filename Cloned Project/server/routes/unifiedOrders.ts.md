# `server/routes/unifiedOrders.ts`

> Express router with 2 endpoints, mounted at `/unified-orders`.

**Kind:** Express router · **Lines:** 846 · **Mounted at:** `/unified-orders` (browser: `/backend/unified-orders`)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (2)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| GET | `/` | `/backend/unified-orders` | `requireAuth` | inline | 659 |
| GET | `/counts` | `/backend/unified-orders/counts` | `requireAuth` | inline | 778 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `UnifiedOrderType` | type |  | 17 |
| `UnifiedOrderItem` | interface |  | 19 |
| `default (router)` | default |  | 845 |

## Interfaces

- **Database (Mongoose models used):**
  - `ProductOrder` (server/models/productOrder.model.ts) — reads: `countDocuments`, `find`
  - `CourseEnrollment` (server/models/courseEnrollment.model.ts) — reads: `countDocuments`, `find`
  - `WorkshopRegistration` (server/models/workshopRegistration.model.ts) — reads: `countDocuments`, `find`
  - `Channel` (server/models/channel.model.ts) — reads: `find`
  - `Subscription` (server/models/subscription.model.ts) — reads: `countDocuments`, `find`
  - `Service` (server/models/service.model.ts) — reads: `find`
  - `ServiceOpt` (server/models/serviceOpt.model.ts) — reads: `countDocuments`, `find`
  - `CallOffering` (server/models/callOffering.model.ts) — reads: `find`
  - `CallPurchase` (server/models/callPurchase.model.ts) — reads: `countDocuments`, `find`

## Dependencies

- **Internal:**
  - `server/middleware/auth.ts` — `requireAuth`
  - `server/models/productOrder.model.ts` — `ProductOrder`
  - `server/models/courseEnrollment.model.ts` — `CourseEnrollment`
  - `server/models/workshopRegistration.model.ts` — `WorkshopRegistration`
  - `server/models/subscription.model.ts` — `Subscription`
  - `server/models/channel.model.ts` — `Channel`
  - `server/models/serviceOpt.model.ts` — `ServiceOpt`
  - `server/models/service.model.ts` — `Service`
  - `server/models/callPurchase.model.ts` — `CallPurchase`
  - `server/models/callOffering.model.ts` — `CallOffering`
- **Packages:**
  - `express` — `Router`, `Request`, `Response`
  - `mongoose` — `Types`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/unified-orders`.
