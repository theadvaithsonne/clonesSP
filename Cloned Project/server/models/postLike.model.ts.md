# `server/models/postLike.model.ts`

> Mongoose model for a user's emoji reaction on a feed post, and the shared list of allowed reaction types.

**Kind:** Mongoose model · **Lines:** 76

## Purpose
Records which reaction each user gave each `Post` (one row per user per post). Counters are kept on `Post.reactionsCount`; this collection is the source for "who reacted" lists, toggling, and the Activity feed. It also owns `REACTION_TYPES`, the single list of emoji types used by both posts and comments.

## How it works
- `REACTION_TYPES = ['like', 'love', 'haha', 'wow', 'sad', 'angry', 'fire', 'money']` (`fire` and `money` added 2026-06-20 with the comment-reaction surface). The schema enum uses the same array so newly introduced reactions are not silently rejected on save.
- Fields: `postId` (ref `Post`), `userId` (ref `User`), `orgId` (ref `Organization`) - required and indexed; `reactionType` (enum, default `'like'`); `timestamps`.
- Indexes:
  - Unique `{ postId, userId }` - one reaction per user per post (changing emoji updates the row).
  - `{ postId }` - counting reactions per post.
  - `{ postId, reactionType }` - counts by type.
  - `{ postId, createdAt: -1 }` - activity feed "reactions across these posts, newest first".

## Exports
- `REACTION_TYPES` - readonly tuple of reaction names.
- `ReactionType` - union type of those names.
- `IPostLike` - document interface.
- `PostLike` - the Mongoose model.

## Interfaces
- **Database:** `PostLike` (collection `postlikes`).

## Dependencies
- **Packages:** `mongoose`.

## Used by
- `server/models/postCommentLike.model.ts` - reuses `REACTION_TYPES`.
- `server/services/feed.ts`, `server/services/feedActivity.ts`, `server/routes/feed.ts` (mounted at `/feed`).
- `server/services/downlineMemberPurchases.ts` - engagement stats.
- `server/services/memberCleanup.service.ts` - deletes a removed member's reactions.

## Notes
- The single-field `{ postId: 1 }` index is redundant (it is a prefix of the other `postId` indexes). The comment says it was deliberately left in place because dropping a live index is an operations decision.
- Adding a reaction type here also requires adding the counter field to `Post.reactionsCount` and `PostComment.reactionsCount`.
