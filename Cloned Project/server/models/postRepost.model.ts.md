# `server/models/postRepost.model.ts`

> Mongoose model recording that a user reposted a community feed post.

**Kind:** Mongoose model · **Lines:** 45

## Purpose
A plain repost (sharing a post without adding text) is a row here; a quote post with commentary is instead a new `Post` with `quotedPostId`. The original post's `repostsCount` counter (on `post.model.ts`) is maintained alongside these rows by the feed service.

## How it works
- Fields: `postId` (ref `Post`), `userId` (ref `User`), `orgId` (ref `Organization`) - required and indexed; `timestamps`.
- Indexes:
  - Unique `{ postId, userId }` - a user can repost a given post only once.
  - `{ userId, createdAt: -1 }` - a user's reposts, newest first.
  - `{ postId, createdAt: -1 }` - reposts of a post, newest first (also used by the activity feed).

## Exports
- `IPostRepost` - document interface.
- `PostRepost` - the Mongoose model.

## Interfaces
- **Database:** `PostRepost` (collection `postreposts`).

## Dependencies
- **Packages:** `mongoose`.

## Used by
- `server/services/feed.ts` - repost/undo and feed assembly.
- `server/services/feedActivity.ts` - "reposted your post" activity.
- `server/services/memberCleanup.service.ts` - deletes a removed member's reposts.
