# `server/models/serviceMilestoneMessage.model.ts`

> Mongoose model for a chat message on one milestone of one service engagement (opt-in), exchanged between the client and the founder.

**Kind:** Mongoose model · **Lines:** 72

## Purpose
When a client opts into a milestone-based `Service`, each milestone gets its own discussion thread instead of a single thread for the whole engagement. Messages are therefore scoped to `(serviceOptId, milestoneId)`.

## How it works
- Fields: `serviceOptId` (ref `ServiceOpt`, indexed), `serviceId` (ref `Service`), `milestoneId` (the `_id` of an entry in `Service.milestones`, no ref), `organizationId` (ref `Organization`), `userId` (ref `User`, the author), `authorRole` (`"client"` | `"founder"`), `message` (trimmed, max 4000 chars). All required; timestamps.
- Index `{ serviceOptId, milestoneId, createdAt }` returns one milestone's thread in chronological order.
- Registered with a `mongoose.models.ServiceMilestoneMessage ||` guard against duplicate model registration.

## Exports
- `ServiceMilestoneMessage` - the model (collection `servicemilestonemessages`).
- `IServiceMilestoneMessage` - document interface.

## Interfaces
- **Database:** `ServiceMilestoneMessage` (collection `servicemilestonemessages`) - schema only.

## Dependencies
- **Packages:** `mongoose` - schema and model.

## Used by
`server/routes/service.ts`, mounted at `/services` (browser: `/backend/services`):
- `GET /opt-ins/:optInId/milestones/:milestoneId/messages` - list a milestone's messages.
- `POST /opt-ins/:optInId/milestones/:milestoneId/messages` - post a message.
- `GET /opt-ins/:optInId/activity` - includes the latest 50 messages across the engagement in the activity feed.
