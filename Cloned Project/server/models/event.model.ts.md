# `server/models/event.model.ts`

> Mongoose model for the legacy internal calendar event: a scheduled org meeting with invited members, invited guests, a public join code and live state.

**Kind:** Mongoose model · **Lines:** 153

## Purpose
This model backs the workspace calendar and its scheduled video meetings. Org members are invited by user id, and external guests by email or through a shareable public join code (similar to Google Meet). It is deliberately separate from `EventProgram` (`eventProgram.model.ts`), which models public conferences sold with tickets. Do not confuse the two.

## How it works
Fields (`IEvent`):
- `orgId` (ref `Organization`) and `creatorId` (ref `User`), both required and indexed.
- `title` (required) and `description`.
- `startTime` (required, indexed) and `endTime` (required).
- `invitedUserIds`: an array of `User` refs.
- `guestInvitations[]`: `{ email (lowercased, required), name, token?, status: "pending" | "joined", joinedAt? }`. `token` is optional and is kept only for older events that used per-guest tokens.
- `publicJoinCode`: an optional shareable code.
- `videoCallInfo`: `{ agoraChannel, createdAt }`. The field name dates from the Agora era. `routes/events.ts` creates it with an empty `agoraChannel` that is filled in when the first user joins.
- `status`: `"scheduled" | "cancelled" | "completed"` (default scheduled, indexed). Also `isRepeating`, `isLive` (indexed) and `liveStartedAt`.
- Timestamps are on.

Indexes: `{ orgId, startTime, status }`, `{ orgId, invitedUserIds, startTime }` and `{ orgId, creatorId, startTime }` for calendar range queries. There is a sparse index on `guestInvitations.token` and a **sparse unique** index on `publicJoinCode`.

Validation: a `pre('save')` hook rejects the document with "End time must be after start time" when `endTime <= startTime`. It only runs on `save()`/`create()`, not on `updateOne` or `findOneAndUpdate`.

## Exports
- `IGuestInvitation`, `IVideoCallInfo`, `IEvent` - interfaces.
- `Event` - the model (default collection `events`).

## Interfaces
- **Database:** `Event` (collection `events`).

## Dependencies
- **Packages:** `mongoose`.

## Used by
- `server/routes/events.ts` (mounted at `/events`): create, list, `GET /active`, get, guests, update, `PATCH /:eventId/start`, `/end`, `/members`, `/cancel`, and delete.
- `server/routes/calendar.ts` (mounted at `/calendar`) - calendar range queries.
- `server/routes/publicEvents.ts` (mounted at `/public/events`) - unauthenticated guest join flow.
- `server/utils/guestToken.ts` - generates and verifies guest tokens against the event.
- `server/realtime/socket.ts` - live meeting state.

## Notes
- `publicJoinCode` is declared with `index: true` in the field and also gets a separate sparse unique index, so Mongoose defines two indexes on the same key. The unique one is the one that matters.
