# `server/routes/productCheckout.ts`

> src/routes/productCheckout.ts Public checkout routes for product purchase links

**Kind:** Express router · **Lines:** 1438 · **Mounted at:** `/checkout` (browser: `/backend/checkout`)

<!-- docgen:auto -->

## Purpose
src/routes/productCheckout.ts
Public checkout routes for product purchase links

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (7)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| GET | `/product/:productId` | `/backend/checkout/product/:productId` | — | inline | 56 |
| POST | `/product/:productId/request-otp` | `/backend/checkout/product/:productId/request-otp` | — | inline | 122 |
| POST | `/product/:productId/verify-otp` | `/backend/checkout/product/:productId/verify-otp` | — | inline | 247 |
| POST | `/product/:productId/verify-session` | `/backend/checkout/product/:productId/verify-session` | `softAuth` | inline | 286 |
| POST | `/product/:productId/process-checkout` | `/backend/checkout/product/:productId/process-checkout` | — | inline | 313 |
| POST | `/product/:productId/verify-payment` | `/backend/checkout/product/:productId/verify-payment` | — | inline | 1054 |
| POST | `/product/:productId/verify-subscription` | `/backend/checkout/product/:productId/verify-subscription` | — | inline | 1358 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 1437 |

## Interfaces

- **Database (Mongoose models used):**
  - `Product` (server/models/product.model.ts) — reads: `findOne`, `findById`
  - `Organization` (server/models/organization.model.ts) — reads: `findById`
  - `User` (server/models/user.model.ts) — reads: `findOne`, `findById`; **writes:** `create`
  - `Bat246Distributor` (server/bat246/models/bat246Distributor.model.ts) — reads: `findOne`; **writes:** `updateOne`
  - `Floor` (server/models/floor.model.ts) — reads: `findOne`
  - `Channel` (server/models/channel.model.ts) — reads: `find`

## Dependencies

- **Internal:**
  - `server/models/product.model.ts` — `Product`
  - `server/models/organization.model.ts` — `Organization`
  - `server/models/user.model.ts` — `User`
  - `server/models/channelMembership.model.ts` — `ChannelMembership`
  - `server/models/channel.model.ts` — `Channel`
  - `server/models/floor.model.ts` — `Floor`
  - `server/services/otp.ts` — `createOtp`, `verifyOtp`
  - `server/middleware/auth.ts` — `softAuth`
  - `server/services/mailer.ts` — `sendMail`, `EMAIL_FROM_OTP`, `senderForHost`
  - `server/services/jwt.ts` — `signJwt`
  - `server/services/razorpay.ts` — `createOrder as createRazorpayOrder`, `verifyPaymentSignature`, `fetchSubscription`, `CouponPromotion`
  - `server/services/invoice.ts` — `createInvoice`, `getNextChargeDate`
  - `server/services/subscription.ts` — `createSubscriptionPlan`, `getSubscriptionPlanForItem`, `createUserSubscription`
  - `server/services/product.ts` — `createOrder as createProductOrder`, `updatePaymentStatus`
  - `server/services/commission.ts` — `distributeCommissions`
  - `server/utils/gstTax.ts` — `getCommissionBase`, `applyGstToLine`
  - `server/utils/gstBuyerRegion.ts` — `resolveBuyerGstRegion`
  - `server/services/init.ts` — `addUserToGarageHQ`
  - `server/services/welcomeEmail.ts` — `sendWelcomeEmail`
  - `server/services/affiliate.ts` — `ensureUserHasAffiliateId`, `setReferredBy`, `setReferredByAffiliateId`
  - `server/bat246/services/bat246Entry.service.ts` — `createBoardFromPurchase`, `addAtBatFromPurchase`, `addToDugoutFromPurchase`, `addFromUpperBaseInvite`, `addFromGenericInvite`
  - `server/bat246/models/bat246Distributor.model.ts` — `Bat246Distributor`
  - `server/services/coupon.ts` — `validateCoupon`, `recordCouponUsage`, `markUsageApplied`, `markUsageFailed`
- **Packages:**
  - `express` — `Router`, `Request`, `Response`
  - `zod` — `z`
  - `mongoose` — `Types`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/checkout`.
