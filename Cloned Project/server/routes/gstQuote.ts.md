# `server/routes/gstQuote.ts`

> src/routes/gstQuote.ts

**Kind:** Express router · **Lines:** 173 · **Mounted at:** `/checkout` (browser: `/backend/checkout`)

<!-- docgen:auto -->

## Purpose
src/routes/gstQuote.ts

Buyer-facing GST quote for founder-sold items.

GST applicability depends on the BUYER's country, which only the server can
resolve (profile country, shipping address). The checkout pages used to
recompute GST client-side behind a `currency === "INR"` gate, which meant a
buyer whose profile says India but who is paying in USD saw one total and
was charged another. This endpoint is the single source of truth for what
the checkout pages render, using the exact same helpers the charge path
uses (utils/gstTax + utils/gstBuyerRegion) so display and charge cannot
drift.

Read-only: no coupons are consumed, no invoice is created.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (1)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| POST | `/gst-quote` | `/backend/checkout/gst-quote` | — | inline | 102 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 172 |

## Interfaces

- **Database (Mongoose models used):**
  - `Channel` (server/models/channel.model.ts) — reads: `findById`
  - `Course` (server/models/course.model.ts) — reads: `findById`
  - `Workshop` (server/models/workshop.model.ts) — reads: `findById`
  - `Product` (server/models/product.model.ts) — reads: `findById`
  - `User` (server/models/user.model.ts) — reads: `findOne`

## Dependencies

- **Internal:**
  - `server/models/channel.model.ts` — `Channel`
  - `server/models/course.model.ts` — `Course`
  - `server/models/workshop.model.ts` — `Workshop`
  - `server/models/product.model.ts` — `Product`
  - `server/models/user.model.ts` — `User`
  - `server/utils/gstTax.ts` — `applyGstToLine`, `GST_CONFIG`
  - `server/utils/gstBuyerRegion.ts` — `resolveBuyerGstRegion`
- **Packages:**
  - `express` — `Router`, `Request`, `Response`
  - `zod` — `z`
  - `mongoose` — `Types`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/checkout`.
