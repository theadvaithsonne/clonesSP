# `server/routes/auth.ts`

> Express router with 17 endpoints, mounted at `/auth`.

**Kind:** Express router · **Lines:** 1627 · **Mounted at:** `/auth` (browser: `/backend/auth`)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (17)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| POST | `/request-otp` | `/backend/auth/request-otp` | — | inline | 84 |
| GET | `/email-available` | `/backend/auth/email-available` | — | inline | 232 |
| POST | `/verify-otp` | `/backend/auth/verify-otp` | — | inline | 255 |
| POST | `/google` | `/backend/auth/google` | — | inline | 571 |
| POST | `/select-org` | `/backend/auth/select-org` | — | inline | 617 |
| POST | `/token-after-org` | `/backend/auth/token-after-org` | — | inline | 667 |
| GET | `/get-user` | `/backend/auth/get-user` | — | inline | 716 |
| POST | `/update-user` | `/backend/auth/update-user` | — | inline | 736 |
| GET | `/me` | `/backend/auth/me` | `requireAuth` | inline | 763 |
| POST | `/logout` | `/backend/auth/logout` | `requireAuth` | inline | 850 |
| POST | `/phone/request-otp` | `/backend/auth/phone/request-otp` | `requireAuth` | inline | 912 |
| POST | `/phone/verify-otp` | `/backend/auth/phone/verify-otp` | `requireAuth` | inline | 1009 |
| GET | `/otp-codes` | `/backend/auth/otp-codes` | `requireGarageAdminAuth`, `requireAdminPage("otp_codes")` | inline | 1230 |
| GET | `/phone-otp-codes` | `/backend/auth/phone-otp-codes` | `requireGarageAdminAuth`, `requireAdminPage("phone_otp_codes")` | inline | 1269 |
| POST | `/associate/request-otp` | `/backend/auth/associate/request-otp` | `requireAuth` | inline | 1326 |
| POST | `/associate/verify` | `/backend/auth/associate/verify` | `requireAuth` | inline | 1410 |
| POST | `/email/verify` | `/backend/auth/email/verify` | `requireAuth` | inline | 1521 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 1626 |

## Interfaces

- **External HTTP calls:**
  - `GET https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}` (L584)
- **Database (Mongoose models used):**
  - `OtpCode` (server/models/otpcode.model.ts) — reads: `findOne`, `find`; **writes:** `deleteMany`
  - `User` (server/models/user.model.ts) — reads: `findOne`, `findById`, `find`, `exists`; **writes:** `new + save`, `updateOne`
  - `OfficeSubscription` (server/models/officeSubscription.model.ts) — reads: `find`
  - `GarageAdminModel` (server/models/garageAdmin.model.ts) — reads: `find`
  - `OtpCodeAccessLog` (server/models/otpCodeAccessLog.model.ts) — **writes:** `updateOne`
- **Environment via `server/config/env.ts`:** `env.GOOGLE_OAUTH_CLIENT_IDS`
- **Timers / queues:** `setTimeout` at L875
- **External hosts mentioned in the code:** `oauth2.googleapis.com`, `accounts.google.com`

## Dependencies

- **Internal:**
  - `server/services/otp.ts` — `createOtp`, `verifyOtp`
  - `server/services/twoFactorSms.ts` — `sendOtpSms`, `normalizePhone`, `storablePhone`, `twoFactorConfigured`
  - `server/services/elevenZaWhatsapp.ts` — `sendOtpWhatsapp`, `elevenZaConfigured`
  - `server/services/mailer.ts` — `sendMail`, `EMAIL_FROM_OTP`, `EMAIL_FROM_RESEND_OTP`, `senderForHost`
  - `server/services/jwt.ts` — `signJwt`
  - `server/config/env.ts` — `env`
  - `server/utils/rbac.ts` — `normalizePermissions`
  - `server/models/user.model.ts` — `User`
  - `server/models/organization.model.ts` — `Organization`
  - `server/models/otpcode.model.ts` — `OtpCode`
  - `server/services/init.ts` — `addUserToGarageHQ`, `addUserToOrg`
  - `server/utils/requestOrg.ts` — `orgIdFromRequest`
  - `server/services/welcomeEmail.ts` — `sendWelcomeEmail`
  - `server/services/downlineTree.ts` — `syncNewEnrollee`
  - `server/services/pendingInvite.ts` — `markPendingInviteUsed`, `pendingReferralFor`
  - `server/middleware/auth.ts` — `requireAuth`
  - `server/services/otpRateLimit.ts` — `checkOtpSendAllowed`
  - `server/services/identifier.ts` — `classifyIdentifier`, `identifierQuery`, `identifierValue`, `identifierError`, `Identifier`
  - `server/middleware/garageAdminAuth.ts` — `requireGarageAdminAuth`, `requireAdminPage`, `GarageAdminRequest`
  - `server/models/garageAdmin.model.ts` — `GarageAdminModel`
  - `server/models/otpCodeAccessLog.model.ts` — `OtpCodeAccessLog`
  - `server/services/socket.ts` — `getSocketInstance`
  - `server/services/redis-presence.ts` — `WorkspacePresenceService`, `isRedisAvailable`
  - `server/models/officeSubscription.model.ts` — `OfficeSubscription`
- **Packages:**
  - `express` — `Router`, `Request`, `Response`
  - `zod` — `z`
  - `mongoose` — `Types`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/auth`.

## Notes

- Large file (1627 lines) — read it by section; line numbers above point into it.
