# `server/routes/guestAuth.ts`

> Express router with 11 endpoints, mounted at `/guest-auth`.

**Kind:** Express router · **Lines:** 1107 · **Mounted at:** `/guest-auth` (browser: `/backend/guest-auth`)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (11)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| POST | `/request-otp` | `/backend/guest-auth/request-otp` | — | inline | 93 |
| POST | `/check-email` | `/backend/guest-auth/check-email` | — | inline | 125 |
| POST | `/verify-otp` | `/backend/guest-auth/verify-otp` | — | inline | 141 |
| GET | `/available-hqs` | `/backend/guest-auth/available-hqs` | — | inline | 241 |
| GET | `/hq-by-slug/:slug` | `/backend/guest-auth/hq-by-slug/:slug` | — | inline | 299 |
| GET | `/hq-items/:slug` | `/backend/guest-auth/hq-items/:slug` | — | inline | 373 |
| POST | `/request-join` | `/backend/guest-auth/request-join` | — | inline | 505 |
| POST | `/public-join` | `/backend/guest-auth/public-join` | — | inline | 639 |
| GET | `/guest-limit-status` | `/backend/guest-auth/guest-limit-status` | — | inline | 861 |
| POST | `/private-join` | `/backend/guest-auth/private-join` | — | inline | 895 |
| GET | `/my-requests` | `/backend/guest-auth/my-requests` | — | inline | 1054 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 1106 |

## Interfaces

- **Database (Mongoose models used):**
  - `User` (server/models/user.model.ts) — reads: `countDocuments`, `exists`, `findOne`, `findById`, `find`; **writes:** `create`
  - `Organization` (server/models/organization.model.ts) — reads: `findById`, `find`, `findOne`
  - `JoinRequest` (server/models/joinRequest.model.ts) — reads: `find`, `findOne`; **writes:** `create`
  - `Product` (server/models/product.model.ts) — reads: `find`
  - `Course` (server/models/course.model.ts) — reads: `find`
  - `Workshop` (server/models/workshop.model.ts) — reads: `find`
  - `Channel` (server/models/channel.model.ts) — reads: `find`
  - `Service` (server/models/service.model.ts) — reads: `find`
  - `Notification` (server/models/notification.model.ts) — **writes:** `create`
  - `Floor` (server/models/floor.model.ts) — reads: `findOne`

## Dependencies

- **Internal:**
  - `server/services/twoFactorSms.ts` — `storablePhone`
  - `server/services/otp.ts` — `createOtp`, `verifyOtp`
  - `server/services/mailer.ts` — `sendMail`, `guestRequestEmailTemplate`, `EMAIL_FROM_OTP`, `EMAIL_FROM_RESEND_OTP`, `EMAIL_FROM_NOTIFICATION`, `senderForHost`
  - `server/models/user.model.ts` — `User`
  - `server/models/organization.model.ts` — `Organization`
  - `server/services/downlineTree.ts` — `syncNewEnrollee`
  - `server/models/joinRequest.model.ts` — `JoinRequest`
  - `server/models/notification.model.ts` — `Notification`
  - `server/models/product.model.ts` — `Product`
  - `server/models/course.model.ts` — `Course`
  - `server/models/workshop.model.ts` — `Workshop`
  - `server/models/channel.model.ts` — `Channel`
  - `server/models/floor.model.ts` — `Floor`
  - `server/models/service.model.ts` — `Service`
  - `server/models/organization.model.ts` — `generateSlug`
  - `server/services/jwt.ts` — `signJwt`
  - `server/utils/affiliateId.ts` — `generateAffiliateId`
  - `server/services/init.ts` — `addUserToGarageHQ`
  - `server/services/welcomeEmail.ts` — `sendWelcomeEmail`
  - `server/services/channel.ts` — `autoJoinEmployeesChannel`, `autoJoinDefaultChannel`
  - `server/services/officeSubscription.ts` — `getActiveOfficeSubscription`
  - `server/models/officePlan.model.ts` — `IOfficePlan`
- **Packages:**
  - `express` — `Router`
  - `zod` — `z`
  - `mongoose` — `Types`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/guest-auth`.
