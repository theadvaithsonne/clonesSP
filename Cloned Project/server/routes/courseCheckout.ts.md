# `server/routes/courseCheckout.ts`

> src/routes/courseCheckout.ts Public checkout routes for course enrollment links

**Kind:** Express router · **Lines:** 879 · **Mounted at:** `/checkout` (browser: `/backend/checkout`)

<!-- docgen:auto -->

## Purpose
src/routes/courseCheckout.ts
Public checkout routes for course enrollment links

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (6)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| GET | `/course/:courseId` | `/backend/checkout/course/:courseId` | — | inline | 47 |
| POST | `/course/:courseId/request-otp` | `/backend/checkout/course/:courseId/request-otp` | — | inline | 110 |
| POST | `/course/:courseId/verify-otp` | `/backend/checkout/course/:courseId/verify-otp` | — | inline | 156 |
| POST | `/course/:courseId/process-checkout` | `/backend/checkout/course/:courseId/process-checkout` | — | inline | 214 |
| POST | `/course/:courseId/verify-payment` | `/backend/checkout/course/:courseId/verify-payment` | — | inline | 623 |
| POST | `/course/:courseId/verify-subscription` | `/backend/checkout/course/:courseId/verify-subscription` | — | inline | 757 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 878 |

## Interfaces

- **Database (Mongoose models used):**
  - `Course` (server/models/course.model.ts) — reads: `findOne`, `findById`
  - `Organization` (server/models/organization.model.ts) — reads: `findById`
  - `User` (server/models/user.model.ts) — reads: `findOne`, `findById`; **writes:** `create`
  - `Floor` (server/models/floor.model.ts) — reads: `findOne`
  - `Channel` (server/models/channel.model.ts) — reads: `find`

## Dependencies

- **Internal:**
  - `server/models/course.model.ts` — `Course`
  - `server/models/organization.model.ts` — `Organization`
  - `server/models/user.model.ts` — `User`
  - `server/models/channelMembership.model.ts` — `ChannelMembership`
  - `server/models/channel.model.ts` — `Channel`
  - `server/models/floor.model.ts` — `Floor`
  - `server/services/otp.ts` — `createOtp`, `verifyOtp`
  - `server/services/mailer.ts` — `sendMail`, `EMAIL_FROM_OTP`, `senderForHost`
  - `server/services/jwt.ts` — `signJwt`
  - `server/services/razorpay.ts` — `createOrder as createRazorpayOrder`, `verifyPaymentSignature`, `fetchSubscription`, `CouponPromotion`
  - `server/services/invoice.ts` — `createInvoice`, `getNextChargeDate`
  - `server/services/subscription.ts` — `createSubscriptionPlan`, `getSubscriptionPlanForItem`, `createUserSubscription`
  - `server/services/course.ts` — `enrollInCourse`
  - `server/services/init.ts` — `addUserToGarageHQ`
  - `server/services/welcomeEmail.ts` — `sendWelcomeEmail`
  - `server/services/affiliate.ts` — `ensureUserHasAffiliateId`, `setReferredBy`, `setReferredByAffiliateId`
  - `server/services/commission.ts` — `distributeCommissions`
  - `server/utils/gstTax.ts` — `getCommissionBase`
  - `server/utils/gstBuyerRegion.ts` — `isBuyerInIndia`
  - `server/services/coupon.ts` — `validateCoupon`, `recordCouponUsage`, `markUsageApplied`, `markUsageFailed`
- **Packages:**
  - `express` — `Router`, `Request`, `Response`
  - `zod` — `z`
  - `mongoose` — `Types`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/checkout`.
