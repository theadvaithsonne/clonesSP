# `server/models/dmSettings.model.ts`

> Mongoose model that stores per-DM conversation settings. Today the only setting is disappearing-message retention.

**Kind:** Mongoose model · **Lines:** 45

## Purpose
A direct-message conversation has no document of its own in this codebase. It exists only as `Message` rows that share a `convId` of the form `dm:<a>:<b>`, with the two user ids sorted. Group chats keep retention on the Group document, but DMs had nowhere to store it, so this collection fills that gap. Rows are keyed by the sorted `convId` (not by a viewer-relative key) because both participants share the setting.

## How it works
- `RETENTION_DAY_OPTIONS = [0, 7, 30, 90, 180, 365]` is the allowed ladder (the same values the group settings route accepts). `0` means off.
- Schema: `convId` (string, required, unique, trimmed), `messageRetentionDays` (number, default 0, enum restricted to the ladder), `updatedBy` (ObjectId ref `User`, default `null`, shown in the UI as "X turned this on"), plus timestamps.
- An index on `messageRetentionDays` lets the retention sweeper find only the conversations where retention is on.

## Exports
- `RETENTION_DAY_OPTIONS` - readonly tuple of allowed day values.
- `IDmSettings` - document shape (`_id`, `convId`, `messageRetentionDays`, `updatedBy`, `createdAt`, `updatedAt`).
- `DmSettings` - the Mongoose model (default collection `dmsettings`).

## Interfaces
- **Database:** `DmSettings` - read and upserted by the DM routes, read by the sweeper.
- **Background work:** the daily DM retention sweeper in `server/index.ts` (`sweepDmRetention`). It runs first 6 minutes after boot and then every 24 hours. It loads every row with `messageRetentionDays > 0` and soft-deletes that conversation's `Message` rows older than the cutoff: it sets `deletedAt` and clears `text`, `attachments` and `reactions`.

## Dependencies
- **Packages:** `mongoose`.

## Used by
- `server/routes/dm.ts` (mounted at `/dm`): `GET /backend/dm/:otherId/settings` reads the row and `PUT /backend/dm/:otherId/settings` upserts it with `findOneAndUpdate`.
- `server/index.ts` - the retention sweeper, which imports this model dynamically.

## Notes
- The model is registered without a `models.DmSettings ||` guard, so loading the file twice in one process would throw.
- The sorted `convId` format comes from `utils/conv.ts`. Any key built differently would silently miss its settings row.
