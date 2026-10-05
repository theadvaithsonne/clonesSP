# `server/models/post.model.ts`

> Mongoose model for a community feed post or long-form article in an organization, with attachments, link previews, denormalised reaction/comment/repost counters, quote posts and polls.

**Kind:** Mongoose model · **Lines:** 166

## Purpose
Each office has a community feed (organised into channels). Every item in it - a short post or an article - is a `Post`. Engagement is stored in companion collections (`PostLike`, `PostComment`, `PostRepost`, `PostBookmark`, `Poll`), while the post keeps running counters so a feed page renders without counting queries.

## How it works

### Content and targeting
- `content` (required), `authorId` (ref `User`, required, indexed), `orgId` (ref `Organization`, required, indexed).
- `channelIds[]` (refs `Channel`) - the feed channels the post appears in.
- `tags[]` (trimmed, max 50 each), `mentions[]` (refs `User`, people @-mentioned).
- `attachments[]` - `{ type: "image" | "video" | "document" | "audio", url, name, fileKey? }` (`fileKey` is the storage key for cleanup).
- `linkPreviews[]` - `{ url, title?, description?, image?, siteName?, showThumbnail (default true) }`. The array uses `default: undefined` so "never set" (older posts) is distinguishable from "empty" (the author removed the previews).

### Counters
- `likesCount` - deprecated, kept for backward compatibility.
- `reactionsCount` - `{ like, love, haha, wow, sad, angry, fire, money, total }`, all default 0, min 0. `fire` and `money` were added on 2026-06-20 with comment reactions; in `IReactionsCount` they are optional so un-backfilled documents still type-check, and readers should treat missing values as 0.
- `commentsCount`, `repostsCount`.

### Post kinds
- `quotedPostId` (ref `Post`, default `null`) - a quote post referencing another post.
- `hasPoll` (default `false`) - when true, a `Poll` document with this `postId` exists.
- `postType` - `"post"` (default) or `"article"`; articles use `title` (max 200), `coverImage`, `slug` and `readingTimeMinutes`.
- `isPinned` (default `false`, indexed), `isActive` (default `true`, soft-delete flag), `timestamps`.

### Indexes
- `{ orgId, createdAt: -1 }`, `{ channelIds, createdAt: -1 }`, `{ authorId, createdAt: -1 }`, `{ tags }`, `{ orgId, channelIds, createdAt: -1 }` - feed listings.
- `{ orgId, isPinned }` (sparse) - pinned posts per org.
- `{ orgId, slug }` unique sparse - article slugs unique within an org.
- `{ mentions, createdAt: -1 }` - multikey, for the "posts that mention me" activity stream.

## Exports
- `IReactionsCount` - reaction counter shape (also used by `postComment.model.ts`).
- `IPost` - document interface.
- `Post` - the Mongoose model.

## Interfaces
- **Database:** `Post` (collection `posts`).

## Dependencies
- **Packages:** `mongoose`.

## Used by
- `server/services/feed.ts` - post CRUD, reactions, comments, polls.
- `server/services/feedActivity.ts` - the Activity feed (`getFeedActivity`, `countFeedActivity`, `getUnreadActivityCount`).
- `server/routes/feed.ts` (mounted at `/feed`), `server/routes/public.ts` (mounted at `/public`), `server/routes/contentEngagement.ts` (mounted at `/content-engagement`, reads a user's articles).
- `server/services/downlineMemberPurchases.ts` - engagement stats for downline members.
- `server/services/memberCleanup.service.ts` - deletes a removed member's posts and `$pull`s them from `mentions`.
- `server/models/postComment.model.ts` - type import of `IReactionsCount`.

## Notes
- Counters are denormalised and maintained by service code; deleting likes or comments in bulk (as the member cleanup does) does not adjust these counters there.
- The `{ orgId, slug }` unique sparse index treats a missing `slug` as unindexed, but an explicit `slug: null` would be indexed and could collide.
