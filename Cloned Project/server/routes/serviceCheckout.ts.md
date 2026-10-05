# `server/routes/serviceCheckout.ts`

> src/routes/serviceCheckout.ts Public checkout routes for service opt-in links

**Kind:** Express router · **Lines:** 491 · **Mounted at:** `/checkout` (browser: `/backend/checkout`)

<!-- docgen:auto -->

## Purpose
src/routes/serviceCheckout.ts
Public checkout routes for service opt-in links

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (5)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| GET | `/service/:serviceId` | `/backend/checkout/service/:serviceId` | — | inline | 27 |
| POST | `/service/:serviceId/init` | `/backend/checkout/service/:serviceId/init` | — | inline | 103 |
| POST | `/service/:serviceId/verify-otp` | `/backend/checkout/service/:serviceId/verify-otp` | — | inline | 149 |
| POST | `/service/:serviceId/update-profile` | `/backend/checkout/service/:serviceId/update-profile` | — | inline | 244 |
| POST | `/service/:serviceId/opt-in` | `/backend/checkout/service/:serviceId/opt-in` | — | inline | 296 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 490 |

## Interfaces

- **Database (Mongoose models used):**
  - `Service` (server/models/service.model.ts) — reads: `findOne`; **writes:** `findByIdAndUpdate`
  - `Organization` (server/models/organization.model.ts) — reads: `findById`
  - `User` (server/models/user.model.ts) — reads: `findOne`, `findById`; **writes:** `create`, `findByIdAndUpdate`
  - `ServiceOpt` (server/models/serviceOpt.model.ts) — reads: `findOne`; **writes:** `create`
  - `Floor` (server/models/floor.model.ts) — reads: `findOne`

## Dependencies

- **Internal:**
  - `server/models/service.model.ts` — `Service`
  - `server/models/serviceOpt.model.ts` — `ServiceOpt`
  - `server/models/organization.model.ts` — `Organization`
  - `server/models/user.model.ts` — `User`
  - `server/models/floor.model.ts` — `Floor`
  - `server/services/otp.ts` — `createOtp`, `verifyOtp`
  - `server/services/mailer.ts` — `sendMail`, `EMAIL_FROM_OTP`, `senderForHost`
  - `server/services/jwt.ts` — `signJwt`
  - `server/services/init.ts` — `addUserToGarageHQ`
  - `server/services/welcomeEmail.ts` — `sendWelcomeEmail`
  - `server/services/affiliate.ts` — `ensureUserHasAffiliateId`, `setReferredByAffiliateId`, `setReferredBy`
  - `server/services/invoice.ts` — `createInvoice`, `getNextChargeDate`
  - `server/services/service.ts` — `resolveMilestoneTiming`
  - `server/services/taskroomProvision.ts` — `provisionEngagementRoomAsync`
- **Packages:**
  - `express` — `Router`, `Request`, `Response`
  - `zod` — `z`
  - `mongoose` — `Types`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/checkout`.
