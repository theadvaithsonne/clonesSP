# `server/models/roomBooking.model.ts`

> Mongoose model for a time-boxed booking of an organisation's conference (HQ) room in the virtual workspace.

**Kind:** Mongoose model · **Lines:** 99

## Purpose
Members can book the workspace conference room for a time slot, with a title, description and invited users. Originally every org had one implicit conference room; the multi-room UI added named rooms (`ConferenceRoom`). Bookings gate who may join the legacy single room and who counts as its host, and expired bookings are closed automatically by the Socket.IO server.

## How it works
- **Fields:** `orgId` (ref `Organization`, required, indexed), `conferenceRoomId` (ref `ConferenceRoom`, optional, sparse index), `creatorId` (ref `User`), `title` (required, max 200), `description` (max 1000), `startTime`, `endTime` (required), `invitedUserIds[]` (ref `User`), `status` (`active` default | `cancelled` | `completed`, indexed), timestamps.
- **Legacy compatibility:** `conferenceRoomId` is optional. New bookings from the multi-room UI always carry it; older rows without it surface under the org's "default" conference room and fall through to org-wide queries.
- **Indexes:** `{ orgId, startTime, status }`, `{ orgId, endTime, status }`, and sparse `{ conferenceRoomId, startTime, status }` for per-room schedules and conflict detection.
- **Validation:** a `pre("save")` hook rejects bookings where `endTime <= startTime` ("End time must be after start time"). This only runs on `save()`/`create()`, not on `updateOne`/`findOneAndUpdate`.

## Exports
- `RoomBooking` - model `"RoomBooking"` (collection `roombookings`).
- `IRoomBooking` - document interface.

## Interfaces
- **Database:** `RoomBooking` (collection `roombookings`) - schema only.
- **Background work:** not in this file, but `server/realtime/socket.ts` runs a 30-second interval that marks expired `active` bookings `completed` and moves users still in `hq-room:<orgId>` back to the lobby (emitting `livekit:leave-call`, `room-booking:auto-kick` and `workspace:user-moved-space`).

## Dependencies
- **Packages:** `mongoose` - `Schema`, `model`.

## Used by
- `server/routes/roomBooking.ts` - mounted at `/room-bookings` (browser: `/backend/room-bookings`): `POST /` create, `GET /` list, `GET /current`, `PATCH /:id` edit, `PATCH /:id/cancel`.
- `server/realtime/socket.ts` - the expiry sweeper above; when joining a legacy HQ room (no `conferenceRoomId`) a LiveKit join is rejected with `livekit:join-error` unless a booking is active now, and the booking's `creatorId` is treated as the room owner/host.
