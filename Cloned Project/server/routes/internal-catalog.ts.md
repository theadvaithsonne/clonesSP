# `server/routes/internal-catalog.ts`

> Internal catalog endpoints used by NetworkChainApi to mirror Garage's sellable-item catalog into Qdrant.

**Kind:** Express router · **Lines:** 858 · **Mounted at:** `/internal/catalog` (browser: `/backend/internal/catalog`)

<!-- docgen:auto -->

## Purpose
Internal catalog endpoints used by NetworkChainApi to mirror Garage's
sellable-item catalog into Qdrant.

IMPORTANT: this endpoint is intentionally separate from the public
`/public/sellable-items` route in `public.ts`. That one paginates in
memory across 6 collections — fine for a small storefront listing, but
fatal at 5K+ items. Here we use **type-round-robin cursor pagination**
with `(updatedAt, _id)` continuation per type: bounded memory regardless
of catalog size.

Auth: `Authorization: Bearer <OPENCLAW_NC_SERVICE_SECRET>`. If the secret
is unset on this side, every request returns 503 — we don't want a silent
unauthenticated fallback for a catalog dump endpoint.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (7)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| GET | `/items` | `/backend/internal/catalog/items` | — | inline | 255 |
| GET | `/items/:type/:id` | `/backend/internal/catalog/items/:type/:id` | — | inline | 526 |
| POST | `/comb-plan-l1` | `/backend/internal/catalog/comb-plan-l1` | — | inline | 591 |
| GET | `/count` | `/backend/internal/catalog/count` | — | inline | 619 |
| POST | `/notify` | `/backend/internal/catalog/notify` | — | inline | 682 |
| POST | `/notify/batch` | `/backend/internal/catalog/notify/batch` | — | inline | 706 |
| GET | `/coupons` | `/backend/internal/catalog/coupons` | — | inline | 754 |

**Router-level middleware** (`router.use`, runs before route matching):
- `requireServiceSecret` (L92)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 857 |

## Interfaces

- **Database (Mongoose models used):**
  - `Organization` (server/models/organization.model.ts) — reads: `find`
  - `CombPlan` (server/models/combPlan.model.ts) — reads: `find`
  - `Coupon` (server/models/coupon.model.ts) — reads: `find`
- **Environment via `server/config/env.ts`:** `env.OPENCLAW_NC_SERVICE_SECRET`, `env.OPENCLAW_NC_SERVICE_SECRET_PREVIOUS`

## Dependencies

- **Internal:**
  - `server/models/jobPosting.model.ts` — `JobPosting`
  - `server/config/env.ts` — `env`
  - `server/models/product.model.ts` — `Product`
  - `server/models/storeProduct.model.ts` — `StoreProduct`
  - `server/models/course.model.ts` — `Course`
  - `server/models/workshop.model.ts` — `Workshop`
  - `server/models/channel.model.ts` — `Channel`
  - `server/models/service.model.ts` — `Service`
  - `server/models/callOffering.model.ts` — `CallOffering`
  - `server/models/organization.model.ts` — `Organization`
  - `server/models/combPlan.model.ts` — `CombPlan`
  - `server/models/coupon.model.ts` — `Coupon`
  - `server/models/officePlan.model.ts` — `OfficePlan`, `OFFICE_COMMISSION_STRUCTURE`
  - `server/models/officeAddon.model.ts` — `OfficeAddon`
  - `server/services/catalogOutbox.service.ts` — `enqueueCatalogChange`
  - `server/models/catalogOutbox.model.ts` — `CatalogOutboxOp`, `(types only)`
  - `server/services/catalogVisibility.ts` — `LEGACY_DIGITAL_PRODUCT_FILTER`, `orgIdsWithActiveStore`
- **Packages:**
  - `express` — `Router`, `Request`, `Response`, `NextFunction`
  - `crypto`
  - `mongoose` — `Model`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/internal/catalog`.
