# `server/models/postCommentLike.model.ts`

> Mongoose model for a single user's emoji reaction on a feed comment, one reaction per user per comment.

**Kind:** Mongoose model · **Lines:** 69

## Purpose
Mirrors `PostLike` (`postLike.model.ts`) for comments instead of posts. Each row records which reaction a user gave a `PostComment`; when the user picks a different emoji, `reactionType` is swapped in place rather than a second row being added. The aggregated counts live on `PostComment.reactionsCount` so the comment list can render counts without an aggregation.

## How it works
- Fields: `commentId` (ref `PostComment`), `userId` (ref `User`), `orgId` (ref `Organization`) - required and indexed; `reactionType` (enum `REACTION_TYPES`, default `"like"`); `timestamps`.
- `REACTION_TYPES` is imported from `postLike.model.ts`, so the post and comment surfaces always accept the same emoji set (adding `fire` and `money` on 2026-06-20 covered both).
- Indexes:
  - Unique `{ commentId, userId }` - one reaction per user per comment.
  - `{ commentId, createdAt: -1 }` - the activity feed's `comment_like` stream (a sorted `$in` on `commentId`), avoiding an in-memory sort.
  - `{ commentId, reactionType }` - listing reactors by reaction type.

## Exports
- `IPostCommentLike` - document interface.
- `PostCommentLike` - the Mongoose model.

## Interfaces
- **Database:** `PostCommentLike` (collection `postcommentlikes`).

## Dependencies
- **Internal:** `server/models/postLike.model.ts` - `REACTION_TYPES` and `ReactionType`.
- **Packages:** `mongoose`.

## Used by
- `server/services/feed.ts` - react/unreact on comments and update counters.
- `server/services/feedActivity.ts` - "reacted to your comment" activity.
- `server/routes/feed.ts` (mounted at `/feed`).
- `server/services/downlineMemberPurchases.ts` - counts comment likes in engagement stats.
