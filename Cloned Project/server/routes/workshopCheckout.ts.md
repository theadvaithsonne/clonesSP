# `server/routes/workshopCheckout.ts`

> src/routes/workshopCheckout.ts Public checkout routes for workshop/webinar enrollment links

**Kind:** Express router · **Lines:** 988 · **Mounted at:** `/checkout` (browser: `/backend/checkout`)

<!-- docgen:auto -->

## Purpose
src/routes/workshopCheckout.ts
Public checkout routes for workshop/webinar enrollment links

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (6)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| GET | `/workshop/:workshopId` | `/backend/checkout/workshop/:workshopId` | — | inline | 41 |
| POST | `/workshop/:workshopId/request-otp` | `/backend/checkout/workshop/:workshopId/request-otp` | — | inline | 194 |
| POST | `/workshop/:workshopId/verify-otp` | `/backend/checkout/workshop/:workshopId/verify-otp` | — | inline | 244 |
| POST | `/workshop/:workshopId/process-checkout` | `/backend/checkout/workshop/:workshopId/process-checkout` | — | inline | 307 |
| POST | `/workshop/:workshopId/verify-payment` | `/backend/checkout/workshop/:workshopId/verify-payment` | — | inline | 732 |
| POST | `/workshop/:workshopId/verify-subscription` | `/backend/checkout/workshop/:workshopId/verify-subscription` | — | inline | 874 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 987 |

## Interfaces

- **Database (Mongoose models used):**
  - `Workshop` (server/models/workshop.model.ts) — reads: `findOne`, `findById`
  - `Organization` (server/models/organization.model.ts) — reads: `findById`
  - `User` (server/models/user.model.ts) — reads: `findOne`, `findById`; **writes:** `create`
  - `Floor` (server/models/floor.model.ts) — reads: `findOne`
  - `Channel` (server/models/channel.model.ts) — reads: `find`
  - `ChannelMembership` (server/models/channelMembership.model.ts) — **writes:** `findOneAndUpdate`

## Dependencies

- **Internal:**
  - `server/models/workshop.model.ts` — `Workshop`
  - `server/models/organization.model.ts` — `Organization`
  - `server/models/user.model.ts` — `User`
  - `server/models/channelMembership.model.ts` — `ChannelMembership`
  - `server/models/channel.model.ts` — `Channel`
  - `server/models/floor.model.ts` — `Floor`
  - `server/services/otp.ts` — `createOtp`, `verifyOtp`
  - `server/services/mailer.ts` — `sendMail`, `EMAIL_FROM_OTP`, `senderForHost`
  - `server/services/jwt.ts` — `signJwt`
  - `server/services/razorpay.ts` — `verifyPaymentSignature`, `fetchSubscription`
  - `server/services/invoice.ts` — `createInvoice`, `getNextChargeDate`
  - `server/services/workshop.ts` — `registerForFreeWorkshop`, `registerForPaidWorkshop`
  - `server/services/init.ts` — `addUserToGarageHQ`
  - `server/services/welcomeEmail.ts` — `sendWelcomeEmail`
  - `server/services/affiliate.ts` — `ensureUserHasAffiliateId`, `setReferredBy`, `setReferredByAffiliateId`
  - `server/services/commission.ts` — `distributeCommissions`
  - `server/services/coupon.ts` — `validateCoupon`, `recordCouponUsage`, `markUsageApplied`, `markUsageFailed`
- **Packages:**
  - `express` — `Router`, `Request`, `Response`
  - `zod` — `z`
  - `mongoose` — `Types`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/checkout`.
