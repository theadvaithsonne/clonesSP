# `server/routes/thirdPartyInvoice.ts`

> Express router with 13 endpoints, mounted at `/api/v1/third-party`.

**Kind:** Express router · **Lines:** 507 · **Mounted at:** `/api/v1/third-party` (browser: `/backend/api/v1/third-party`)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (13)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| GET | `/terms` | `/backend/api/v1/third-party/terms` | `requireScope("invoices:read")` | inline | 52 |
| GET | `/customers/:email/subscriptions` | `/backend/api/v1/third-party/customers/:email/subscriptions` | `requireScope("invoices:read")` | inline | 92 |
| PATCH | `/subscriptions/:parentInvoiceId/term` | `/backend/api/v1/third-party/subscriptions/:parentInvoiceId/term` | `requireScope("invoices:write")` | inline | 126 |
| POST | `/invoices` | `/backend/api/v1/third-party/invoices` | `requireScope("invoices:write")` | inline | 177 |
| GET | `/invoices` | `/backend/api/v1/third-party/invoices` | `requireScope("invoices:read")` | inline | 226 |
| GET | `/invoices/:id` | `/backend/api/v1/third-party/invoices/:id` | `requireScope("invoices:read")` | inline | 261 |
| GET | `/invoices/:id/status` | `/backend/api/v1/third-party/invoices/:id/status` | `requireScope("invoices:read")` | inline | 285 |
| GET | `/invoices/:id/payment-link` | `/backend/api/v1/third-party/invoices/:id/payment-link` | `requireScope("invoices:read")` | inline | 313 |
| POST | `/invoices/:id/cancel` | `/backend/api/v1/third-party/invoices/:id/cancel` | `requireScope("invoices:write")` | inline | 337 |
| GET | `/invoices/:id/receipt` | `/backend/api/v1/third-party/invoices/:id/receipt` | `requireScope("invoices:read")` | inline | 356 |
| POST | `/invoices/:id/resend-webhook` | `/backend/api/v1/third-party/invoices/:id/resend-webhook` | `requireScope("invoices:write")` | inline | 378 |
| GET | `/customers/:email/invoices` | `/backend/api/v1/third-party/customers/:email/invoices` | `requireScope("invoices:read")` | inline | 408 |
| GET | `/clients/me` | `/backend/api/v1/third-party/clients/me` | — | inline | 440 |

**Router-level middleware** (`router.use`, runs before route matching):
- `requireThirdPartyApiKey` (L27)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 506 |

## Interfaces

- **Environment variables (`process.env`):** `FRONTEND_URL`

## Dependencies

- **Internal:**
  - `server/middleware/thirdPartyAuth.ts` — `requireThirdPartyApiKey`, `requireScope`
  - `server/services/thirdPartyInvoice.ts` — `createThirdPartyInvoice`, `listThirdPartyInvoices`, `getThirdPartyInvoice`, `cancelThirdPartyInvoice`, `getThirdPartyInvoiceReceipt`, `listCustomerInvoices`, `retryInvoiceWebhook`, `ThirdPartyError`
  - `server/models/thirdPartyClient.model.ts` — `IThirdPartyClient`
  - `server/services/thirdPartyTerms.ts` — `listActiveTermPlans`, `defaultTermMonths`, `changeSubscriptionTerm`, `listSubscriptionsForUser`
- **Packages:**
  - `express` — `Router`, `Request`, `Response`
  - `zod` — `z`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/api/v1/third-party`.
