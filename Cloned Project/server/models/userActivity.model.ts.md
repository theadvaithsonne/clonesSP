# `server/models/userActivity.model.ts`

> Mongoose model for per-user, per-organisation activity log entries (presence changes, tasks, bookings, messages and similar).

**Kind:** Mongoose model · **Lines:** 87

## Purpose
Stores a feed of activity events for a member within an organisation. It originally powered the "Team Activity" feature; that frontend has been retired and the `/user-activity` router is commented out in `server/app.ts`, but the Socket.IO server still writes `online`/`offline` presence rows, which the code comments say feed the OnlineActivityTab analytics dashboard.

## How it works
Fields (timestamps on):
- `userId` (-> `User`, required, indexed), `orgId` (-> `Organization`, required, indexed)
- `type` (required, indexed): `login`, `logout`, `online`, `offline`, `task_created`, `task_completed`, `task_assigned`, `booking_created`, `booking_cancelled`, `message_sent`, `file_uploaded`, `profile_updated`, `floor_assigned`, `group_joined`, `group_left`, `system`
- `title`, `description` (required, trimmed)
- `metadata` (Mixed, default `{}`) - extra ids such as task or booking id
- `isRead` (default false, indexed), `readAt`
- `category` (required, indexed): `auth`, `task`, `booking`, `communication`, `file`, `profile`, `system`, `presence`
- `priority` (`low | medium | high`, default `medium`, indexed)

Compound indexes: `{userId, orgId, createdAt:-1}`, `{userId, isRead}`, `{orgId, type, createdAt:-1}`, `{userId, category, createdAt:-1}`.

The export uses `models.UserActivity || model(...)` so re-importing the module (for example the dynamic import in `betty.ts`) does not throw `OverwriteModelError`.

## Exports
- `UserActivity` - Mongoose model `"UserActivity"` (collection `useractivities`).

## Interfaces
- **Database:** `UserActivity` (collection `useractivities`).

## Dependencies
- **Packages:** `mongoose` - `Schema`, `model`, `models`, `Types`.

## Used by
- `server/realtime/socket.ts` - creates an `online` row (category `presence`, priority `low`) when a user's first socket connects and an `offline` row when they go offline; the old `activity:new` broadcast is commented out.
- `server/routes/betty.ts` - reads activities (dynamic import).
- `server/services/memberCleanup.service.ts` - `deleteMany` when a member is removed.
- `server/routes/userActivity.ts` - imports it, but that router is not mounted (disabled in `server/app.ts`).

## Notes
- Presence rows are written on every first connect / final disconnect with no deduplication (per the socket code comments), so the collection grows steadily.
