# `server/models/postComment.model.ts`

> Mongoose model for comments and nested replies on community feed posts, with attachments, mentions and denormalised reaction counts.

**Kind:** Mongoose model · **Lines:** 108

## Purpose
Every comment on a `Post` (`post.model.ts`) is a `PostComment`. A reply is a comment whose `parentCommentId` points at another comment. Comments carry their own reaction counters (same shape as posts) so the web app and mobile can show reactions without a separate count query; individual reactions live in `postCommentLike.model.ts`.

## How it works
- **Attachment sub-schema** (`_id: false`): `type` (`image` / `video` / `document` / `audio` / `gif`), `url`, `name` (required), `fileKey`. The enum was widened to match the route's Zod schema and the `addComment` service; the old `image | gif | audio` list silently rejected video and document saves.
- **Fields:** `postId` (ref `Post`), `userId` (ref `User`), `orgId` (ref `Organization`) - required and indexed; `content` (max 2000, default `""`, so an attachment-only comment is allowed); `mentions[]` (refs `User`); `attachments[]`; `parentCommentId` (ref `PostComment`, default `null` for top-level comments); `reactionsCount` `{ like, love, haha, wow, sad, angry, fire, money, total }` (default 0 each); `isActive` (default `true`, soft delete); `timestamps`.
- **Indexes:**
  - `{ postId, createdAt: 1 }` - a post's comments in order.
  - `{ postId, parentCommentId }` - replies within a post.
  - `{ userId, createdAt: -1 }` - a user's comments.
  - `{ parentCommentId, createdAt: -1 }` - the activity feed's `reply` stream (a sorted `$in` on `parentCommentId`); without it the query was a collection scan with an in-memory sort, the 32 MB sort failure `services/feedActivity.ts` guards against.
  - `{ mentions, orgId, createdAt: -1 }` - multikey, for the `comment_mention` stream; previously every Activity load and unread-badge poll scanned the whole collection.

## Exports
- `ICommentAttachment` - attachment interface.
- `IPostComment` - document interface.
- `PostComment` - the Mongoose model.

## Interfaces
- **Database:** `PostComment` (collection `postcomments`).

## Dependencies
- **Internal:** `server/models/post.model.ts` - type-only import of `IReactionsCount`.
- **Packages:** `mongoose`.

## Used by
- `server/services/feed.ts` - add/list/delete comments; keeps `Post.commentsCount` in step.
- `server/services/feedActivity.ts` - reply and mention activity.
- `server/routes/feed.ts` (mounted at `/feed`).
- `server/services/downlineMemberPurchases.ts` - engagement stats.
- `server/services/memberCleanup.service.ts` - deletes a removed member's comments.

## Notes
- Reaction counters here are min-unconstrained (no `min: 0`, unlike `Post.reactionsCount`), so a buggy decrement could make them negative.
