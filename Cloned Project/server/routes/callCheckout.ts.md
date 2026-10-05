# `server/routes/callCheckout.ts`

> src/routes/callCheckout.ts Public checkout routes for call purchase links

**Kind:** Express router · **Lines:** 582 · **Mounted at:** `/checkout` (browser: `/backend/checkout`)

<!-- docgen:auto -->

## Purpose
src/routes/callCheckout.ts
Public checkout routes for call purchase links

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (5)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| GET | `/call/:callId` | `/backend/checkout/call/:callId` | — | inline | 35 |
| POST | `/call/:callId/request-otp` | `/backend/checkout/call/:callId/request-otp` | — | inline | 100 |
| POST | `/call/:callId/verify-otp` | `/backend/checkout/call/:callId/verify-otp` | — | inline | 147 |
| POST | `/call/:callId/process-checkout` | `/backend/checkout/call/:callId/process-checkout` | — | inline | 203 |
| POST | `/call/:callId/verify-payment` | `/backend/checkout/call/:callId/verify-payment` | — | inline | 442 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 581 |

## Interfaces

- **Database (Mongoose models used):**
  - `CallOffering` (server/models/callOffering.model.ts) — reads: `findOne`, `findById`
  - `Organization` (server/models/organization.model.ts) — reads: `findById`
  - `User` (server/models/user.model.ts) — reads: `findOne`, `findById`; **writes:** `new + save`
  - `Floor` (server/models/floor.model.ts) — reads: `findOne`
  - `Channel` (server/models/channel.model.ts) — reads: `find`

## Dependencies

- **Internal:**
  - `server/models/callOffering.model.ts` — `CallOffering`
  - `server/models/organization.model.ts` — `Organization`
  - `server/models/user.model.ts` — `User`
  - `server/models/channelMembership.model.ts` — `ChannelMembership`
  - `server/models/channel.model.ts` — `Channel`
  - `server/models/floor.model.ts` — `Floor`
  - `server/services/otp.ts` — `createOtp`, `verifyOtp`
  - `server/services/mailer.ts` — `sendMail`, `EMAIL_FROM_OTP`, `senderForHost`
  - `server/services/jwt.ts` — `signJwt`
  - `server/services/razorpay.ts` — `verifyPaymentSignature`
  - `server/services/call.ts` — `* as callService`
  - `server/services/init.ts` — `addUserToGarageHQ`
  - `server/services/welcomeEmail.ts` — `sendWelcomeEmail`
  - `server/services/affiliate.ts` — `ensureUserHasAffiliateId`, `setReferredBy`, `setReferredByAffiliateId`
  - `server/services/commission.ts` — `distributeCommissions`
  - `server/services/invoice.ts` — `createInvoice`, `getNextChargeDate`
- **Packages:**
  - `express` — `Router`, `Request`, `Response`
  - `zod` — `z`
  - `mongoose` — `Types`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/checkout`.
