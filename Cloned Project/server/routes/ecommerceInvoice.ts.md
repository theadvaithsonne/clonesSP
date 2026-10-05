# `server/routes/ecommerceInvoice.ts`

> Express router with 2 endpoints, mounted at `/api/ecommerce`.

**Kind:** Express router · **Lines:** 214 · **Mounted at:** `/api/ecommerce` (browser: `/backend/api/ecommerce`)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (2)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| POST | `/cart/preview` | `/backend/api/ecommerce/cart/preview` | `requireAuth` | inline | 120 |
| POST | `/invoices` | `/backend/api/ecommerce/invoices` | `requireAuth` | inline | 146 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 213 |

## Interfaces

- **Database (Mongoose models used):**
  - `User` (server/models/user.model.ts) — reads: `findById`

## Dependencies

- **Internal:**
  - `server/middleware/auth.ts` — `requireAuth`
  - `server/models/user.model.ts` — `User`
  - `server/services/ecommerceInvoice.ts` — `previewEcommerceCart`, `createEcommerceInvoice`, `EcommerceError`
- **Packages:**
  - `express` — `Router`, `Request`, `Response`
  - `zod` — `z`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/api/ecommerce`.
