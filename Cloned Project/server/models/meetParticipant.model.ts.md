# `server/models/meetParticipant.model.ts`

> Mongoose model recording each person who joins a `Meet`, with their display name, host flag and join/leave times.

**Kind:** Mongoose model · **Lines:** 66

## Purpose
Every join of a Garage Meet (meeting, workshop preview, founder stream) produces a `MeetParticipant` row. These rows answer "who was in this meeting, when, and who was the host", and they feed attendance-style views such as the founder stream table.

## How it works
- Fields:
  - `meetId` (ref `Meet`, required, indexed).
  - `email` (required, lowercased, trimmed, indexed), `displayName` (required, max 100).
  - `isHost` (default false, indexed).
  - `agoraUid` (number, optional, indexed) - defaults to a random six-digit number (`Math.floor(Math.random() * 900000) + 100000`). The inline comment calls it a legacy field from the Agora migration and notes that Daily.co uses a string `user_id` from tokens.
  - `joinedAt` (required, default `Date.now`), `leftAt` (optional; unset while the person is still in the room).
- Timestamps on.
- Compound indexes: `{ meetId: 1, email: 1 }`, `{ meetId: 1, isHost: 1 }`, `{ meetId: 1, joinedAt: 1 }`.
- No uniqueness constraint, so one person can have several rows for the same meet (one per join).

## Exports
- `MeetParticipant` - Mongoose model `"MeetParticipant"`.
- `IMeetParticipant` - interface.

## Interfaces
- **Database:** `MeetParticipant` (collection `meetparticipants`) - read/write.

## Dependencies
- **Packages:** `mongoose`.

## Used by
- `server/routes/meet.ts` (`/meet`), `server/routes/publicMeet.ts`, `server/routes/workshopPreview.ts`.
- `server/services/founderStreamTable.ts`, `server/services/workshop.ts`.

## Notes
- The random `agoraUid` default is not guaranteed unique within a meet. It is a leftover identifier, so do not rely on it as a key.
