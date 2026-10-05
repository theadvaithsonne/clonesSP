# `server/models/appSubscription.model.ts`

> Mongoose model `AppSubscription`: records that a user has added (subscribed to) an app within an organisation.

**Kind:** Mongoose model · **Lines:** 29

## Purpose
Backs the user's "my apps" list. Each row remembers an app (by its string `appId`) a user has added in a specific organisation, with a snapshot of its display data.

## How it works
- `userId` (ref `User`), `organizationId` (ref `Organization`), `appId` (string) - required and indexed.
- `name`, `url` - required display data; `icon`, `description` - optional.
- Unique compound index `{ userId, appId, organizationId }` prevents duplicates per user/app/org.
- Timestamps on; collection `appsubscriptions`.

## Exports
- `AppSubscription` - Mongoose model.

## Interfaces
- **Database:** `AppSubscription` (collection `appsubscriptions`).

## Dependencies
- **Packages:** `mongoose`.

## Used by
`server/routes/apps.ts`, mounted at `/apps` (browser `/backend/apps`): `GET /apps/my`, `POST /apps/subscribe`, `DELETE /apps/:appId`, plus `GET /apps/admin/assignees` and `POST /apps/admin/assign`.

## Notes
- The schema uses `Types.ObjectId` (rather than `Schema.Types.ObjectId`) as the field type, which Mongoose accepts.
