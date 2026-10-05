# `server/routes/webinarRoutes.ts`

> Express router with 13 endpoints, mounted at `/webinar`.

**Kind:** Express router · **Lines:** 1689 · **Mounted at:** `/webinar` (browser: `/backend/webinar`)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (13)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| POST | `/:workshopId/guest-token` | `/backend/webinar/:workshopId/guest-token` | — | inline | 128 |
| POST | `/:workshopId/livekit-token` | `/backend/webinar/:workshopId/livekit-token` | — | inline | 212 |
| POST | `/:workshopId/start` | `/backend/webinar/:workshopId/start` | `requireAuth` | inline | 463 |
| POST | `/:workshopId/stop` | `/backend/webinar/:workshopId/stop` | `requireAuth` | inline | 690 |
| POST | `/:workshopId/recording` | `/backend/webinar/:workshopId/recording` | `requireAuth`, `upload.single("recording")` | inline | 723 |
| GET | `/:workshopId/recordings` | `/backend/webinar/:workshopId/recordings` | `requireAuth` | inline | 861 |
| GET | `/:workshopId/recordings/:recordingId/playlist` | `/backend/webinar/:workshopId/recordings/:recordingId/playlist` | `requireAuth` | inline | 935 |
| PATCH | `/:workshopId/recordings/:recordingId` | `/backend/webinar/:workshopId/recordings/:recordingId` | `requireAuth` | inline | 1005 |
| DELETE | `/:workshopId/recordings/:recordingId` | `/backend/webinar/:workshopId/recordings/:recordingId` | `requireAuth` | inline | 1143 |
| GET | `/:workshopId/analytics` | `/backend/webinar/:workshopId/analytics` | `requireAuth` | inline | 1264 |
| GET | `/:workshopId/attendees.csv` | `/backend/webinar/:workshopId/attendees.csv` | `requireAuth` | inline | 1478 |
| GET | `/:workshopId/messages` | `/backend/webinar/:workshopId/messages` | `requireAuth` | inline | 1591 |
| POST | `/chat/attach` | `/backend/webinar/chat/attach` | `requireAuth` | inline | 1638 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 1688 |

## Interfaces

- **Database (Mongoose models used):**
  - `Workshop` (server/models/workshop.model.ts) — reads: `findById`
  - `WorkshopSessionOverride` (server/models/workshopSessionOverride.model.ts) — **writes:** `findOneAndUpdate`
  - `Meet` (server/models/meet.model.ts) — reads: `findById`; **writes:** `findByIdAndUpdate`, `create`
  - `User` (server/models/user.model.ts) — reads: `findById`
  - `NoteSession` (server/note-taker/models/note-session.model.ts) — reads: `findOne`, `findById`; **writes:** `create`
  - `OrganizationCabinet` (server/models/cabinet.model.ts) — reads: `findOne`; **writes:** `create`
  - `OrganizationFile` (server/models/cabinet.model.ts) — reads: `find`, `findById`; **writes:** `create`, `findByIdAndDelete`
- **Environment variables (`process.env`):** `AWS_S3_BUCKET`, `AWS_S3_REGION`
- **Environment via `server/config/env.ts`:** `env.FRONTEND_URL`
- **Timers / queues:** `setTimeout` at L95, L653
- **Filesystem writes:** `writeFile(inputPath)` (L63)

## Dependencies

- **Internal:**
  - `server/realtime/webinarEnd.ts` — `endWebinarSession`
  - `server/middleware/auth.ts` — `requireAuth`
  - `server/models/workshop.model.ts` — `Workshop`
  - `server/services/workshop.ts` — `isBilledSpeaker`
  - `server/models/meet.model.ts` — `Meet`
  - `server/models/user.model.ts` — `User`
  - `server/utils/accessCheck.ts` — `hasFounderAccess`
  - `server/utils/rbac.ts` — `isFounderOrModuleAdmin`
  - `server/services/webinarHost.ts` — `claimSessionHost`, `getSessionHost`, `releaseSessionHost`
  - `server/services/mediasoup.ts` — `getRoom`, `removeRoom`
  - `server/services/livekit.ts` — `createParticipantToken`, `getLivekitUrl`, `toLivekitRoomName`
  - `server/utils/meetCode.ts` — `generateMeetJoinCode`, `generateMeetAgoraChannel`
  - `server/config/env.ts` — `env`
  - `server/services/socket.ts` — `emitWorkshopPreviewUpdate`
  - `server/services/s3.ts` — `s3Service`
  - `server/utils/recordingTime.ts` — `recordingStartedAt`
  - `server/models/cabinet.model.ts` — `OrganizationCabinet`, `OrganizationFile`
  - `server/note-taker/agents/bot-manager.ts` — `BotManager`
  - `server/models/workshopSessionOverride.model.ts` — `WorkshopSessionOverride`
  - `server/utils/workshopStatus.ts` — `sessionDayKey`
  - `server/note-taker/models/note-session.model.ts` — `NoteSession`
- **Packages:**
  - `express` — `Router`
  - `mongoose` — `Types`
  - `child_process` — `spawn`
  - `fs`
  - `path`
  - `os`
  - `multer`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/webinar`.

## Notes

- Security-relevant constructs: `spawn()` (L72).
- Large file (1689 lines) — read it by section; line numbers above point into it.
