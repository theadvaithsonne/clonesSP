# `server/routes/channelCheckout.ts`

> src/routes/channelCheckout.ts Public checkout routes for channel subscription links

**Kind:** Express router · **Lines:** 846 · **Mounted at:** `/checkout` (browser: `/backend/checkout`)

<!-- docgen:auto -->

## Purpose
src/routes/channelCheckout.ts
Public checkout routes for channel subscription links

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (6)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| GET | `/channel/:channelId` | `/backend/checkout/channel/:channelId` | — | inline | 43 |
| POST | `/channel/:channelId/request-otp` | `/backend/checkout/channel/:channelId/request-otp` | — | inline | 109 |
| POST | `/channel/:channelId/verify-otp` | `/backend/checkout/channel/:channelId/verify-otp` | — | inline | 154 |
| POST | `/channel/:channelId/process-checkout` | `/backend/checkout/channel/:channelId/process-checkout` | — | inline | 226 |
| POST | `/channel/:channelId/verify-payment` | `/backend/checkout/channel/:channelId/verify-payment` | — | inline | 633 |
| POST | `/channel/:channelId/verify-subscription` | `/backend/checkout/channel/:channelId/verify-subscription` | — | inline | 747 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 845 |

## Interfaces

- **Database (Mongoose models used):**
  - `Channel` (server/models/channel.model.ts) — reads: `findOne`, `findById`
  - `Organization` (server/models/organization.model.ts) — reads: `findById`
  - `User` (server/models/user.model.ts) — reads: `findOne`, `findById`; **writes:** `create`
  - `ChannelMembership` (server/models/channelMembership.model.ts) — reads: `findOne`; **writes:** `findOneAndUpdate`
  - `Floor` (server/models/floor.model.ts) — reads: `findOne`

## Dependencies

- **Internal:**
  - `server/models/channel.model.ts` — `Channel`
  - `server/models/organization.model.ts` — `Organization`
  - `server/models/user.model.ts` — `User`
  - `server/models/channelMembership.model.ts` — `ChannelMembership`
  - `server/models/floor.model.ts` — `Floor`
  - `server/services/otp.ts` — `createOtp`, `verifyOtp`
  - `server/services/mailer.ts` — `sendMail`, `EMAIL_FROM_OTP`, `senderForHost`
  - `server/services/jwt.ts` — `signJwt`
  - `server/services/razorpay.ts` — `createOrder as createRazorpayOrder`, `verifyPaymentSignature`, `fetchSubscription`, `CouponPromotion`
  - `server/services/invoice.ts` — `createInvoice`, `getNextChargeDate`
  - `server/services/subscription.ts` — `createSubscriptionPlan`, `getSubscriptionPlanForItem`, `createUserSubscription`
  - `server/services/init.ts` — `addUserToGarageHQ`
  - `server/services/channel.ts` — `autoJoinDefaultChannel`
  - `server/services/welcomeEmail.ts` — `sendWelcomeEmail`
  - `server/services/affiliate.ts` — `ensureUserHasAffiliateId`, `setReferredBy`, `setReferredByAffiliateId`
  - `server/services/coupon.ts` — `validateCoupon`, `recordCouponUsage`, `markUsageApplied`, `markUsageFailed`
- **Packages:**
  - `express` — `Router`, `Request`, `Response`
  - `zod` — `z`
  - `mongoose` — `Types`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/checkout`.
