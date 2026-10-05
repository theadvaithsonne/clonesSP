# `server/models/postBookmark.model.ts`

> Mongoose model for a user saving (bookmarking) a community feed post.

**Kind:** Mongoose model · **Lines:** 49

## Purpose
Lets a member save posts to read later and lets the feed's Activity view show who saved a post. One document per (post, user).

## How it works
- Fields: `postId` (ref `Post`), `userId` (ref `User`), `orgId` (ref `Organization`) - all required and individually indexed; `timestamps`.
- Indexes:
  - Unique `{ postId: 1, userId: 1 }` - a user can bookmark a post only once.
  - `{ userId: 1, orgId: 1, createdAt: -1 }` - "my saved posts in this org", newest first (the most common query).
  - `{ postId: 1, createdAt: -1 }` - the inverse, "who saved these posts", used by the activity feed.

## Exports
- `IPostBookmark` - document interface.
- `PostBookmark` - the Mongoose model.

## Interfaces
- **Database:** `PostBookmark` (collection `postbookmarks`).

## Dependencies
- **Packages:** `mongoose`.

## Used by
- `server/services/feed.ts` - add/remove bookmarks and list saved posts.
- `server/services/feedActivity.ts` - "saved your post" activity.
- `server/services/memberCleanup.service.ts` - deletes a removed member's bookmarks.

## Notes
- Unlike likes and reposts, the `Post` model keeps no bookmark counter.
