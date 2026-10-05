# `server/routes/livekitRecording.ts`

> Express router with 18 endpoints, mounted at `/webhooks/livekit`.

**Kind:** Express router · **Lines:** 1263 · **Mounted at:** `/webhooks/livekit`, `/livekit`, `/workspace/conference` (browser: `/backend/webhooks/livekit`, `/backend/livekit`, `/backend/workspace/conference`)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (18)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| POST | `/recording/start` | `/backend/webhooks/livekit/recording/start` | — | inline | 43 |
| POST | `/recording/stop` | `/backend/webhooks/livekit/recording/stop` | — | inline | 82 |
| POST | `/` | `/backend/webhooks/livekit` | — | inline | 107 |
| GET | `/conference/recordings` | `/backend/webhooks/livekit/conference/recordings` | `requireAuth` | `listConferenceRecordingsHandler` | 587 |
| POST | `/kick` | `/backend/webhooks/livekit/kick` | `requireAuth` | inline | 610 |
| POST | `/mute` | `/backend/webhooks/livekit/mute` | `requireAuth` | inline | 643 |
| POST | `/notetaker/start` | `/backend/webhooks/livekit/notetaker/start` | `requireAuth` | inline | 688 |
| POST | `/notetaker/stop` | `/backend/webhooks/livekit/notetaker/stop` | `requireAuth` | inline | 737 |
| POST | `/policy` | `/backend/webhooks/livekit/policy` | `requireAuth` | inline | 859 |
| GET | `/policy` | `/backend/webhooks/livekit/policy` | `requireAuth` | inline | 902 |
| POST | `/permission/request` | `/backend/webhooks/livekit/permission/request` | `requireAuth` | inline | 922 |
| POST | `/permission/grant` | `/backend/webhooks/livekit/permission/grant` | `requireAuth` | inline | 975 |
| POST | `/permission/deny` | `/backend/webhooks/livekit/permission/deny` | `requireAuth` | inline | 1041 |
| DELETE | `/conference/recordings/:id` | `/backend/webhooks/livekit/conference/recordings/:id` | `requireAuth` | inline | 1084 |
| POST | `/end-meeting` | `/backend/webhooks/livekit/end-meeting` | `requireAuth` | `endMeetingHandler` | 1191 |
| POST | `/end` | `/backend/webhooks/livekit/end` | `requireAuth` | `endMeetingHandler` | 1204 |
| GET | `/recordings` | `/backend/webhooks/livekit/recordings` | `requireAuth` | `listConferenceRecordingsHandler` | 1210 |
| POST | `/token/guest` | `/backend/webhooks/livekit/token/guest` | — | inline | 1215 |

The router is also mounted at `/livekit`, `/workspace/conference`; every path above exists under each mount.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `livekitWebhookRouter` | const | `= Router()` — POST /webhooks/livekit Handles LiveKit webhook events, primarily egress_ended for recording uploads. | 105 |
| `registerDirectS3Recording` | function | `async registerDirectS3Recording(s3Key: string, fileResult: { size?: number; duration?: number } \| null, roomName: string, egressId: string, context: { organizationId: string; userId: string…` — For direct-to-S3 egress uploads: the file is already in our bucket, so we skip download + reupload and just persist the OrganizationFile row that Learn → Live Streams (and the cabinet UI) read from. | 280 |
| `default (router)` | default |  | 1262 |

## Interfaces

- **Socket.IO events:**
  - emits: `livekit:policy-updated`
- **Database (Mongoose models used):**
  - `OrganizationFile` (server/models/cabinet.model.ts) — reads: `findOne`, `find`, `findById`; **writes:** `create`, `deleteOne`
  - `OrganizationCabinet` (server/models/cabinet.model.ts) — reads: `findOne`; **writes:** `create`
  - `User` (server/models/user.model.ts) — reads: `findById`
- **Environment variables (`process.env`):** `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `AWS_S3_BUCKET`, `AWS_S3_REGION`

## Dependencies

- **Internal:**
  - `server/services/livekit.ts` — `getRecordingContext`, `startRoomCompositeEgress`, `stopEgress`, `getActiveEgress`, `clearActiveEgress`, `getRoomServiceClient`, `getConferencePolicy`, `setConferencePolicy`, … +6
  - `server/note-taker/agents/bot-manager.ts` — `BotManager as ConferenceBotManager`
  - `server/realtime/socket.ts` — `ensureConferenceNoteTaker`
  - `server/services/socket.ts` — `getSocketInstance`
  - `server/services/mediasoup.ts` — `getRoom as getWebinarRoom`
  - `server/models/user.model.ts` — `User`
  - `server/services/s3.ts` — `s3Service`
  - `server/models/cabinet.model.ts` — `OrganizationCabinet`, `OrganizationFile`
  - `server/utils/videoCompression.ts` — `compressVideo`
  - `server/middleware/auth.ts` — `requireAuth`
- **Packages:**
  - `express` — `Router`, `Request`, `Response`
  - `livekit-server-sdk` — `WebhookReceiver`

## Used by

- `server/app.ts`
- `server/services/webinarLivekitRecording.ts`

Entry: mounted in `server/app.ts` at `/webhooks/livekit`, `/livekit`, `/workspace/conference`.
