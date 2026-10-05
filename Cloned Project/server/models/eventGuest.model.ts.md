# `server/models/eventGuest.model.ts`

> Mongoose model that records an external guest who joined a legacy calendar `Event` meeting, by email and display name.

**Kind:** Mongoose model · **Lines:** 67

## Purpose
When someone outside the org joins a calendar meeting through the public join code (or a legacy per-guest token), a row is written here. It records who they were, when they joined and when they left, so organisers can see guest attendance.

## How it works
Fields (`IEventGuest`):
- `eventId` (ref `Event`, required, indexed).
- `email` (required, lowercased, indexed) and `displayName` (required, max 100).
- `token`: optional, sparse-indexed. It is not used by the public join-code flow.
- `agoraUid`: a legacy number left over from the Agora migration. It still defaults to a random 6-digit number (100000-999999) and is indexed. The schema comment notes that the newer video provider uses string user ids from its tokens instead.
- `joinedAt` (required, default now) and `leftAt`.
- Timestamps are on.

Indexes: `{ eventId, email }`, `{ eventId, joinedAt }`, and a sparse `{ token, eventId }`.

## Exports
- `IEventGuest` - interface.
- `EventGuest` - the model (default collection `eventguests`).

## Interfaces
- **Database:** `EventGuest` (collection `eventguests`).

## Dependencies
- **Packages:** `mongoose`.

## Used by
- `server/routes/publicEvents.ts` (mounted at `/public/events`) - writes guests when they join.
- `server/routes/events.ts` (mounted at `/events`) - `GET /backend/events/:eventId/guests` lists them.
- `server/realtime/socket.ts` - live meeting presence.

## Notes
- `{ eventId, email }` is not unique, so the same guest rejoining can produce more than one row.
- The `sparse: true` option on the single-field `token` index has no practical effect for missing values on a non-unique index. It is harmless.
