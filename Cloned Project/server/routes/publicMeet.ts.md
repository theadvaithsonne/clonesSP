# `server/routes/publicMeet.ts`

> Express router with 16 endpoints, mounted at `/public/meet`.

**Kind:** Express router · **Lines:** 1756 · **Mounted at:** `/public/meet` (browser: `/backend/public/meet`)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (16)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| GET | `/validate` | `/backend/public/meet/validate` | — | inline | 183 |
| POST | `/host-request-otp` | `/backend/public/meet/host-request-otp` | — | inline | 422 |
| POST | `/host-verify-otp` | `/backend/public/meet/host-verify-otp` | — | inline | 514 |
| POST | `/start` | `/backend/public/meet/start` | — | inline | 655 |
| POST | `/end` | `/backend/public/meet/end` | — | inline | 751 |
| POST | `/check-user` | `/backend/public/meet/check-user` | — | inline | 835 |
| POST | `/join-request-otp` | `/backend/public/meet/join-request-otp` | — | inline | 904 |
| POST | `/join-verify-otp` | `/backend/public/meet/join-verify-otp` | — | inline | 975 |
| POST | `/update-name` | `/backend/public/meet/update-name` | — | inline | 1065 |
| POST | `/join` | `/backend/public/meet/join` | — | inline | 1110 |
| GET | `/participants` | `/backend/public/meet/participants` | — | inline | 1264 |
| POST | `/leave` | `/backend/public/meet/leave` | — | inline | 1323 |
| POST | `/kick` | `/backend/public/meet/kick` | — | inline | 1371 |
| POST | `/screen-share/start` | `/backend/public/meet/screen-share/start` | — | inline | 1444 |
| POST | `/screen-share/stop` | `/backend/public/meet/screen-share/stop` | — | inline | 1520 |
| GET | `/attendance` | `/backend/public/meet/attendance` | — | inline | 1580 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 1755 |

## Interfaces

- **Database (Mongoose models used):**
  - `User` (server/models/user.model.ts) — reads: `findOne`; **writes:** `create`
  - `Floor` (server/models/floor.model.ts) — reads: `findOne`
  - `Workshop` (server/models/workshop.model.ts) — reads: `findOne`
  - `Meet` (server/models/meet.model.ts) — reads: `findById`; **writes:** `updateOne`
  - `Organization` (server/models/organization.model.ts) — reads: `findById`
  - `MeetParticipant` (server/models/meetParticipant.model.ts) — reads: `findOne`, `find`, `findById`; **writes:** `create`, `updateMany`, `findByIdAndUpdate`
  - `WorkshopRegistration` (server/models/workshopRegistration.model.ts) — reads: `find`

## Dependencies

- **Internal:**
  - `server/models/meet.model.ts` — `Meet`
  - `server/models/meetParticipant.model.ts` — `MeetParticipant`
  - `server/models/workshop.model.ts` — `Workshop`
  - `server/models/workshopRegistration.model.ts` — `WorkshopRegistration`
  - `server/models/user.model.ts` — `User`
  - `server/models/floor.model.ts` — `Floor`
  - `server/models/channelMembership.model.ts` — `ChannelMembership`
  - `server/models/organization.model.ts` — `Organization`
  - `server/utils/meetCode.ts` — `verifyMeetJoinCode`, `isHostEmail`, `isScheduledInterviewMeet`
  - `server/services/otp.ts` — `createOtp`, `verifyOtp`
  - `server/services/mailer.ts` — `sendMail`, `EMAIL_FROM_OTP`, `senderForHost`
  - `server/services/jwt.ts` — `generateGuestSocketToken`
  - `server/services/livekit.ts` — `createRoom`, `createParticipantToken`, `deleteRoom`, `toLivekitRoomName`, `setRecordingContext`, `getLivekitUrl`
  - `server/services/socket.ts` — `emitWorkshopPreviewUpdate`
  - `server/services/init.ts` — `addUserToGarageHQ`
  - `server/services/welcomeEmail.ts` — `sendWelcomeEmail`
  - `server/services/affiliate.ts` — `ensureUserHasAffiliateId`, `setReferredBy`, `setReferredByAffiliateId`
- **Packages:**
  - `express` — `Router`, `Request`, `Response`
  - `zod` — `z`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/public/meet`.

## Notes

- Large file (1756 lines) — read it by section; line numbers above point into it.
