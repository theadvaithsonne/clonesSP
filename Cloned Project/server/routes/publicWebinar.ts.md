# `server/routes/publicWebinar.ts`

> Express router with 13 endpoints, mounted at `/public/webinar`.

**Kind:** Express router · **Lines:** 2062 · **Mounted at:** `/public/webinar` (browser: `/backend/public/webinar`)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (13)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| GET | `/debug` | `/backend/public/webinar/debug` | — | inline | 187 |
| GET | `/validate` | `/backend/public/webinar/validate` | — | inline | 206 |
| POST | `/join-request-otp` | `/backend/public/webinar/join-request-otp` | — | inline | 416 |
| POST | `/join-verify-otp` | `/backend/public/webinar/join-verify-otp` | — | inline | 479 |
| POST | `/join-anonymous` | `/backend/public/webinar/join-anonymous` | — | inline | 620 |
| GET | `/:id/evergreen-state` | `/backend/public/webinar/:id/evergreen-state` | — | inline | 705 |
| GET | `/:id/simulated-audience` | `/backend/public/webinar/:id/simulated-audience` | — | inline | 873 |
| POST | `/demo-host-join` | `/backend/public/webinar/demo-host-join` | — | inline | 945 |
| POST | `/prepare-join` | `/backend/public/webinar/prepare-join` | `requireAuth` | inline | 1006 |
| GET | `/:workshopId/messages` | `/backend/public/webinar/:workshopId/messages` | — | inline | 1794 |
| GET | `/:workshopId/pins` | `/backend/public/webinar/:workshopId/pins` | — | inline | 1854 |
| GET | `/:workshopId/attendees` | `/backend/public/webinar/:workshopId/attendees` | — | inline | 1950 |
| GET | `/for-org/:orgId` | `/backend/public/webinar/for-org/:orgId` | — | inline | 2009 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 2061 |

## Interfaces

- **Database (Mongoose models used):**
  - `User` (server/models/user.model.ts) — reads: `findOne`, `findById`; **writes:** `create`
  - `Floor` (server/models/floor.model.ts) — reads: `findOne`
  - `Channel` (server/models/channel.model.ts) — reads: `find`
  - `Workshop` (server/models/workshop.model.ts) — reads: `findById`, `findOne`
  - `Organization` (server/models/organization.model.ts) — reads: `findById`
  - `Meet` (server/models/meet.model.ts) — reads: `findById`
  - `WorkshopSessionOverride` (server/models/workshopSessionOverride.model.ts) — reads: `findOne`, `find`
  - `ChannelMembership` (server/models/channelMembership.model.ts) — reads: `findOne`

## Dependencies

- **Internal:**
  - `server/models/workshop.model.ts` — `Workshop`
  - `server/models/user.model.ts` — `User`
  - `server/models/floor.model.ts` — `Floor`
  - `server/models/channelMembership.model.ts` — `ChannelMembership`
  - `server/models/channel.model.ts` — `Channel`
  - `server/models/organization.model.ts` — `Organization`
  - `server/services/otp.ts` — `createOtp`, `verifyOtp`
  - `server/services/mailer.ts` — `sendMail`, `EMAIL_FROM_OTP`, `senderForHost`
  - `server/services/jwt.ts` — `signJwt`
  - `server/services/init.ts` — `addUserToGarageHQ`
  - `server/services/channel.ts` — `autoJoinDefaultChannel`
  - `server/services/welcomeEmail.ts` — `sendWelcomeEmail`
  - `server/services/affiliate.ts` — `ensureUserHasAffiliateId`, `setReferredBy`, `setReferredByAffiliateId`
  - `server/models/meet.model.ts` — `Meet`
  - `server/services/webinarHost.ts` — `isStreamStaff`
  - `server/services/mediasoup.ts` — `rooms`
  - `server/middleware/auth.ts` — `requireAuth`
  - `server/services/workshop.ts` — `hasSessionAccess`, `registerForFreeWorkshop`
  - `server/utils/recurrence.ts` — `calculateSessions`, `isValidSessionDate`, `getNextSession`
  - `server/models/workshopSessionOverride.model.ts` — `WorkshopSessionOverride`
  - `server/services/s3.ts` — `s3Service`
  - `server/utils/workshopStatus.ts` — `isSessionDeleted`, `sessionDayKey`, `computeSessionWindow`, `deriveClockStatus`
  - `server/utils/sessionOverlay.ts` — `resolveEffectiveSession`, `resolveSessionPricing`
  - `server/services/invoice.ts` — `createInvoice`
- **Packages:**
  - `express` — `Router`, `Request`, `Response`
  - `mongoose` — `Types`
  - `zod` — `z`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/public/webinar`.

## Notes

- Large file (2062 lines) — read it by section; line numbers above point into it.
