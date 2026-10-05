# `server/models/feedActivityRead.model.ts`

> Mongoose model that stores, per user and per organisation, when the user last read their feed Activity screen. It drives the unread badge.

**Kind:** Mongoose model · **Lines:** 56

## Purpose
The feed activity endpoints are scoped to an org (`?orgId=`). A single `lastActivityReadAt` field on `User` would mean that reading activity in one org silently clears the unread badge in another, and users belonging to several orgs are normal here. So the read marker lives in its own collection, one document per `{ userId, orgId }`. It is written only when the user opens the Activity screen (read-all), so the collection stays small and is rarely touched.

## How it works
- Fields (`IFeedActivityRead`):
  - `userId` (ref `User`) and `orgId` (ref `Organization`), both required and indexed.
  - `lastReadAt` (required, default now). Everything created after this moment counts as unread.
  - Timestamps are on.
- A unique compound index on `{ userId, orgId }` guarantees that concurrent upserts cannot create two markers. Two markers would make the unread count depend on which one was read.

## Exports
- `IFeedActivityRead` - interface.
- `FeedActivityRead` - the model (default collection `feedactivityreads`).

## Interfaces
- **Database:** `FeedActivityRead` - read to compute unread counts and upserted on read-all.

## Dependencies
- **Packages:** `mongoose`.

## Used by
- `server/services/feedActivity.ts` - `findOne` the marker to count unread activity, and `findOneAndUpdate` (upsert) when the user marks everything read. The feed routes (mounted at `/feed`) reach it through that service.

## Notes
- A user who has never opened Activity in an org has no marker. How that case counts is decided in `feedActivity.ts`, not here.
