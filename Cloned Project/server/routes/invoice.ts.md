# `server/routes/invoice.ts`

> src/routes/invoice.ts Invoice API routes — public + authenticated endpoints

**Kind:** Express router · **Lines:** 2640 · **Mounted at:** `/api/invoices` (browser: `/backend/api/invoices`)

<!-- docgen:auto -->

## Purpose
src/routes/invoice.ts
Invoice API routes — public + authenticated endpoints

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (28)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| GET | `/payment-options` | `/backend/api/invoices/payment-options` | — | inline | 149 |
| GET | `/my/pending-count` | `/backend/api/invoices/my/pending-count` | `requireAuth` | inline | 204 |
| POST | `/cron/generate-recurring` | `/backend/api/invoices/cron/generate-recurring` | — | inline | 237 |
| GET | `/sellables` | `/backend/api/invoices/sellables` | `requireAuth` | inline | 324 |
| GET | `/:invoiceId` | `/backend/api/invoices/:invoiceId` | — | inline | 394 |
| POST | `/:invoiceId/customer` | `/backend/api/invoices/:invoiceId/customer` | — | inline | 566 |
| POST | `/:invoiceId/select-payment` | `/backend/api/invoices/:invoiceId/select-payment` | — | inline | 644 |
| POST | `/:invoiceId/verify-payment` | `/backend/api/invoices/:invoiceId/verify-payment` | — | inline | 854 |
| POST | `/:invoiceId/confirm-stripe-payment` | `/backend/api/invoices/:invoiceId/confirm-stripe-payment` | — | inline | 996 |
| POST | `/:invoiceId/cancel` | `/backend/api/invoices/:invoiceId/cancel` | — | inline | 1142 |
| POST | `/:parentId/cancel-subscription` | `/backend/api/invoices/:parentId/cancel-subscription` | `requireAuth` | inline | 1180 |
| POST | `/:parentId/renew-subscription` | `/backend/api/invoices/:parentId/renew-subscription` | `requireAuth` | inline | 1214 |
| GET | `/autopay/status` | `/backend/api/invoices/autopay/status` | `requireAuth` | inline | 1258 |
| POST | `/autopay/disable` | `/backend/api/invoices/autopay/disable` | `requireAuth` | inline | 1278 |
| POST | `/:parentId/autopay/enable` | `/backend/api/invoices/:parentId/autopay/enable` | `requireAuth` | inline | 1310 |
| POST | `/:invoiceId/apply-platform-coupon` | `/backend/api/invoices/:invoiceId/apply-platform-coupon` | `softAuth` | inline | 1353 |
| POST | `/:invoiceId/gstin` | `/backend/api/invoices/:invoiceId/gstin` | `softAuth` | inline | 1589 |
| POST | `/:invoiceId/pay-with-wallet` | `/backend/api/invoices/:invoiceId/pay-with-wallet` | `requireAuth` | inline | 1694 |
| POST | `/:invoiceId/request-otp` | `/backend/api/invoices/:invoiceId/request-otp` | — | inline | 1998 |
| POST | `/:invoiceId/verify-otp` | `/backend/api/invoices/:invoiceId/verify-otp` | — | inline | 2036 |
| POST | `/:invoiceId/handoff-token` | `/backend/api/invoices/:invoiceId/handoff-token` | `requireAuth` | inline | 2103 |
| POST | `/:invoiceId/handoff-exchange` | `/backend/api/invoices/:invoiceId/handoff-exchange` | — | inline | 2155 |
| GET | `/:invoiceId/receipt` | `/backend/api/invoices/:invoiceId/receipt` | — | inline | 2214 |
| POST | `/generate` | `/backend/api/invoices/generate` | `requireAuth` | inline | 2277 |
| GET | `/my/list` | `/backend/api/invoices/my/list` | `requireAuth` | inline | 2422 |
| GET | `/subscriptions/:parentId` | `/backend/api/invoices/subscriptions/:parentId` | `requireAuth` | inline | 2491 |
| GET | `/my/upcoming` | `/backend/api/invoices/my/upcoming` | `requireAuth` | inline | 2579 |
| GET | `/crypto/chains` | `/backend/api/invoices/crypto/chains` | — | inline | 2628 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 2639 |

## Interfaces

- **Database (Mongoose models used):**
  - `Bat246PendingPlacement` (server/bat246/models/bat246PendingPlacement.model.ts) — **writes:** `updateOne`
  - `Bat246PositionReservation` (server/bat246/models/bat246PositionReservations.model.ts) — **writes:** `updateOne`
  - `Bat246PlacementNotification` (server/bat246/models/bat246PlacementNotifications.model.ts) — reads: `exists`; **writes:** `create`
  - `Organization` (server/models/organization.model.ts) — reads: `findOne`, `findById`
  - `User` (server/models/user.model.ts) — reads: `findById`, `findOne`
  - `Product` (server/models/product.model.ts) — reads: `findById`
- **Environment variables (`process.env`):** `CRON_WEBHOOK_SECRET`
- **Environment via `server/config/env.ts`:** `env.FRONTEND_URL`

## Dependencies

- **Internal:**
  - `server/utils/exchangeRate.ts` — `SUPPORTED_FIAT_CURRENCIES`
  - `server/services/invoice.ts` — `getInvoice`, `selectPaymentMethod`, `verifyAndCompletePayment`, `cancelInvoice`, `CryptoPaymentInFlightError`, `cancelSubscription`, `renewSubscription`, `getPaymentOptions`, … +7
  - `server/services/invoicePayable.ts` — `refuseIfNotPayable`
  - `server/services/coupon.ts` — `markUsageApplied`, `markUsageFailed`
  - `server/services/franchiseSubscriptions.ts` — `expireFranchiseSubscriptions`
  - `server/services/franchiseOffer.ts` — `expireStalePendingOffers`
  - `server/services/franchiseGlobalOffer.ts` — `expireStaleGlobalPendingOffers`
  - `server/middleware/auth.ts` — `requireAuth`, `softAuth`
  - `server/models/organization.model.ts` — `Organization`
  - `server/models/user.model.ts` — `User`
  - `server/models/product.model.ts` — `Product`
  - `server/services/affiliate.ts` — `getReferrerInfo`
  - `server/services/sellables.ts` — `getSellable`, `listOrgSellables`, `toInvoiceItemType`, `SellableItemType`
  - `server/services/otp.ts` — `createOtp`, `verifyOtp`
  - `server/services/mailer.ts` — `sendMail`, `EMAIL_FROM_OTP`, `senderForHost`
  - `server/bat246/services/bat246Entry.service.ts` — `createBoardFromPurchase`, `addAtBatFromPurchase`, `addFromUpperBaseInvite`, `addToDugoutFromPurchase`, `addFromGenericInvite`
  - `server/bat246/models/bat246PendingPlacement.model.ts` — `Bat246PendingPlacement`
  - `server/bat246/models/bat246PlacementNotifications.model.ts` — `Bat246PlacementNotification`
  - `server/bat246/models/bat246PositionReservations.model.ts` — `Bat246PositionReservation`
  - `server/services/jwt.ts` — `signJwt`, `verifyJwt`
  - `server/config/env.ts` — `env`
- **Packages:**
  - `express` — `Router`, `Request`, `Response`
  - `zod` — `z`
  - `mongoose` — `Types`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/api/invoices`.

## Notes

- Large file (2640 lines) — read it by section; line numbers above point into it.
