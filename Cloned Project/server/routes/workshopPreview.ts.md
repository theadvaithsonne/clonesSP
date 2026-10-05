# `server/routes/workshopPreview.ts`

> Express router with 6 endpoints, mounted at `/workshop-preview`.

**Kind:** Express router · **Lines:** 594 · **Mounted at:** `/workshop-preview` (browser: `/backend/workshop-preview`)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (6)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| POST | `/debug-go-live/:workshopId` | `/backend/workshop-preview/debug-go-live/:workshopId` | — | inline | 22 |
| GET | `/live` | `/backend/workshop-preview/live` | — | inline | 57 |
| POST | `/audience-token` | `/backend/workshop-preview/audience-token` | — | inline | 249 |
| GET | `/status/:meetId` | `/backend/workshop-preview/status/:meetId` | — | inline | 351 |
| GET | `/live-all` | `/backend/workshop-preview/live-all` | — | inline | 408 |
| GET | `/:workshopId/pinned-product` | `/backend/workshop-preview/:workshopId/pinned-product` | — | inline | 577 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 593 |

## Interfaces

- **Database (Mongoose models used):**
  - `Workshop` (server/models/workshop.model.ts) — reads: `findById`, `find`
  - `Meet` (server/models/meet.model.ts) — reads: `find`, `findById`; **writes:** `findByIdAndUpdate`
  - `MeetParticipant` (server/models/meetParticipant.model.ts) — reads: `countDocuments`, `aggregate`
  - `Channel` (server/models/channel.model.ts) — reads: `find`
  - `Organization` (server/models/organization.model.ts) — reads: `find`
- **Environment via `server/config/env.ts`:** `env.FRONTEND_URL`

## Dependencies

- **Internal:**
  - `server/models/workshop.model.ts` — `Workshop`
  - `server/models/channel.model.ts` — `Channel`
  - `server/models/meet.model.ts` — `Meet`
  - `server/models/meetParticipant.model.ts` — `MeetParticipant`
  - `server/models/organization.model.ts` — `Organization`
  - `server/services/livekit.ts` — `createRoom`, `createParticipantToken`, `toLivekitRoomName`, `getLivekitUrl`, `getWebinarViewerCount`
  - `server/services/mediasoup.ts` — `getRoom`
  - `server/services/socket.ts` — `emitWorkshopPreviewUpdate`
  - `server/realtime/socket.ts` — `getPreviewWatcherCount`
  - `server/config/env.ts` — `env`
- **Packages:**
  - `express` — `Router`
  - `zod` — `z`
  - `mongoose` — `Types`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/workshop-preview`.
