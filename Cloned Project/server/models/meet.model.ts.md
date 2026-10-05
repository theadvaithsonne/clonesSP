# `server/models/meet.model.ts`

> Mongoose model for a scheduled or live Garage Meet session (the room behind meet/conference pages and workshop/webinar streams), keyed by a unique join code.

**Kind:** Mongoose model · **Lines:** 121

## Purpose
A `Meet` represents one meeting room belonging to an organization: its host, title, time window, public `joinCode` and lifecycle status. Meets are created by hand through `POST /meet`, and automatically when a workshop generates a meeting or a webinar is started. They are then joined via the code. Participants are tracked separately in `MeetParticipant`.

## How it works
### Fields
| Field | Notes |
|---|---|
| `orgId` | Ref `Organization`, required, indexed. |
| `hostEmail` | Required, lowercased, trimmed, indexed. Host identity is checked by email (see `isHostEmail` in `server/utils/meetCode.ts`). |
| `hostName` | Optional. |
| `title` | Required, max 200. |
| `description` | **No maxlength, deliberately** (see Notes). |
| `startTime` (required, indexed), `endTime` (required) | The scheduled window. |
| `joinCode` | Required, **unique**, indexed. The public code in meet URLs. |
| `status` | `scheduled` (default) \| `live` \| `ended` \| `cancelled`, indexed. |
| `isHostVerified` | Default false. |
| `agoraChannel` | Required string. A legacy name from the Agora era; it still holds the room/channel identifier. |
| `startedAt`, `endedAt` | Actual start and end. |
| `screenSharingByUid` | Number, default null. Per the interface comment, the UID of whoever is screen sharing (only the host may share). |

Timestamps on.

### Indexes
- `{ orgId: 1, startTime: 1, status: 1 }` - an org's schedule.
- `{ hostEmail: 1, startTime: 1 }` - a host's meetings.
- `{ joinCode: 1, status: 1 }` - join lookups that exclude cancelled meets (`Meet.findOne({ joinCode, status: { $nin: ["cancelled"] } })` in `meetCode.ts`).

### Hooks
A `pre("save")` hook exists but only calls `next()`. Its comment explains that the end-after-start check was dropped on purpose because midnight-crossing meetings (for example 11:50 PM to 12:30 AM) are valid, and the route handler deals with day rollover.

## Exports
- `Meet` - Mongoose model `"Meet"`.
- `IMeet` - interface.

## Interfaces
- **Database:** `Meet` (collection `meets`) - read/write.
- **Background work:** `server/index.ts` runs a stale live-meet sweeper. It sets `status: "ended"` and `endedAt` on any `live` Meet whose `endTime` has passed, or that has no `endTime` and was started more than 8 hours ago. This catches hosts who closed the browser without stopping the meeting.

## Dependencies
- **Packages:** `mongoose`.

## Used by
- `server/routes/meet.ts` (mounted at `/meet`, browser `/backend/meet`), `server/routes/publicMeet.ts`, `server/routes/publicWebinar.ts`, `server/routes/webinarRoutes.ts`, `server/routes/workshop.ts`, `server/routes/workshopPreview.ts`.
- `server/realtime/mediasoupHandlers.ts` (webinar SFU host join) and `server/realtime/webinarEnd.ts`.
- `server/services/workshop.ts`, `server/services/jobs.ts`, `server/utils/meetCode.ts`, `server/index.ts` (stale-meet sweeper).

## Notes
- **Why `description` has no cap:** a workshop's uncapped rich-text description is copied verbatim into its Meet by three paths: `routes/workshop.ts` `/generate-meeting`, `routes/webinarRoutes.ts` `/webinar/:id/start`, and the socket host-join in `realtime/mediasoupHandlers.ts`. An earlier cap made `Meet.create` throw, which left workshops stuck in Draft and stopped founders starting streams (the comment cites a 1,396-character description as the repro). The hand-typed `POST /meet` field keeps its own `z.string().max(1000)` check so it returns a clean 400.
- `joinCode` declares both `unique` and `index`, so Mongoose may warn about a duplicate index definition.
