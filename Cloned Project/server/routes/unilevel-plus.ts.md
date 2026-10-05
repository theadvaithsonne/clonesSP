# `server/routes/unilevel-plus.ts`

> Express router with 22 endpoints, mounted at `/unilevel-plus`.

**Kind:** Express router · **Lines:** 2161 · **Mounted at:** `/unilevel-plus` (browser: `/backend/unilevel-plus`)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (22)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| POST | `/plans` | `/backend/unilevel-plus/plans` | `requireAuth` | inline | 52 |
| GET | `/plans` | `/backend/unilevel-plus/plans` | `requireAuth` | inline | 95 |
| GET | `/plans/:id` | `/backend/unilevel-plus/plans/:id` | `requireAuth` | inline | 140 |
| PUT | `/plans/:id` | `/backend/unilevel-plus/plans/:id` | `requireAuth` | inline | 161 |
| DELETE | `/plans/:id` | `/backend/unilevel-plus/plans/:id` | `requireAuth` | inline | 202 |
| GET | `/product` | `/backend/unilevel-plus/product` | `requireAuth` | inline | 226 |
| GET | `/my-invoices` | `/backend/unilevel-plus/my-invoices` | `requireAuth` | inline | 400 |
| POST | `/checkout/create-order` | `/backend/unilevel-plus/checkout/create-order` | `requireAuth` | inline | 439 |
| POST | `/checkout/create-combo-invoice` | `/backend/unilevel-plus/checkout/create-combo-invoice` | `requireAuth` | inline | 722 |
| POST | `/checkout/claim-free-month` | `/backend/unilevel-plus/checkout/claim-free-month` | `requireAuth` | inline | 1082 |
| POST | `/checkout/subscribe` | `/backend/unilevel-plus/checkout/subscribe` | `requireAuth` | inline | 1253 |
| POST | `/checkout/verify-payment` | `/backend/unilevel-plus/checkout/verify-payment` | `requireAuth` | inline | 1396 |
| GET | `/commissions/my-history` | `/backend/unilevel-plus/commissions/my-history` | `requireAuth` | inline | 1599 |
| GET | `/commissions/stats` | `/backend/unilevel-plus/commissions/stats` | `requireAuth` | inline | 1642 |
| GET | `/commissions/distribution/:id` | `/backend/unilevel-plus/commissions/distribution/:id` | `requireAuth` | inline | 1665 |
| GET | `/network/legs` | `/backend/unilevel-plus/network/legs` | `requireAuth` | inline | 1708 |
| GET | `/reserve` | `/backend/unilevel-plus/reserve` | `requireAuth` | inline | 1784 |
| GET | `/reserve/stats` | `/backend/unilevel-plus/reserve/stats` | `requireAuth` | inline | 1819 |
| POST | `/reserve/:licenseId/assign` | `/backend/unilevel-plus/reserve/:licenseId/assign` | `requireAuth` | inline | 1840 |
| GET | `/users/search` | `/backend/unilevel-plus/users/search` | `requireAuth` | inline | 1906 |
| GET | `/checkout/combo-status/:upInvoiceId` | `/backend/unilevel-plus/checkout/combo-status/:upInvoiceId` | `requireAuth` | inline | 1965 |
| POST | `/checkout/retry-combo/:upInvoiceId` | `/backend/unilevel-plus/checkout/retry-combo/:upInvoiceId` | `requireInternalKey` | inline | 2088 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 2160 |

## Interfaces

- **Database (Mongoose models used):**
  - `User` (server/models/user.model.ts) — reads: `findById`, `find`
  - `Invoice` (server/models/invoice.model.ts) — reads: `findOne`, `find`, `findById`; **writes:** `updateOne`
  - `ThirdPartyClient` (server/models/thirdPartyClient.model.ts) — reads: `find`, `findById`
  - `UnilevelPlusPurchase` (server/models/unilevelPlusPurchase.model.ts) — reads: `find`; **writes:** `create`
  - `UnilevelPlusDistribution` (server/models/unilevelPlusDistribution.model.ts) — reads: `findById`
- **Environment variables (`process.env`):** `RAZORPAY_KEY_ID`

## Dependencies

- **Internal:**
  - `server/services/downlineTree.ts` — `refreshTypeFlags`
  - `server/middleware/auth.ts` — `requireAuth`, `requireInternalKey`
  - `server/services/unilevelPlusCommission.ts` — `createUnilevelPlusPlan`, `getUnilevelPlusPlan`, `getActiveUnilevelPlusPlan`, `getUnilevelPlusPlansByOrg`, `updateUnilevelPlusPlan`, `deleteUnilevelPlusPlan`, `getUserPurchase`, `distributeUnilevelPlusCommission`, … +2
  - `server/models/unilevelPlusPurchase.model.ts` — `UnilevelPlusPurchase`
  - `server/models/unilevelPlusDistribution.model.ts` — `UnilevelPlusDistribution`
  - `server/models/user.model.ts` — `User`
  - `server/services/razorpay.ts` — `createOrder as createRazorpayOrder`, `verifyPaymentSignature`
  - `server/services/invoice.ts` — `createInvoice`
  - `server/models/invoice.model.ts` — `Invoice`, `couponProductTypeForItem`
  - `server/models/thirdPartyClient.model.ts` — `ThirdPartyClient`
  - `server/services/comboActivation.ts` — `activateComboFreeFirstMonth`
  - `server/services/comboWindow.ts` — `comboWindowFor`
  - `server/services/thirdPartyInvoice.ts` — `createThirdPartyInvoice`
  - `server/services/thirdPartyTerms.ts` — `resolveTermPlan`, `listActiveTermPlans`, `defaultTermMonths`
  - `server/utils/gstTax.ts` — `calculateTaxAmounts`, `GST_CONFIG`, `applyGstToLine`
  - `server/utils/gstBuyerRegion.ts` — `resolveBuyerGstRegion`, `gstSkippedMetadata`
- **Packages:**
  - `express` — `Router`, `Request`, `Response`
  - `zod` — `z`
  - `mongoose` — `Types`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/unilevel-plus`.

## Notes

- Large file (2161 lines) — read it by section; line numbers above point into it.
