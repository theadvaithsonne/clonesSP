# `server/services/feedActivity.ts`

> Module exporting `getFeedActivity`, `countFeedActivity`, `getUnreadActivityCount`, `markActivityRead`.

**Kind:** backend service · **Lines:** 560

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `FeedActivityType` | type |  | 46 |
| `FEED_ACTIVITY_TYPES` | const | `= [ "like", "comment", "mention", "save", "repost", "reply", "comment_mention", "comment_…` | 56 |
| `FeedActivityActor` | interface |  | 67 |
| `FeedActivityPost` | interface |  | 73 |
| `FeedActivityRow` | interface |  | 80 |
| `getFeedActivity` | function | `async getFeedActivity(userId: string, orgId: string, options: { limit?: number; offset?: number; type?: FeedActi…): Promise<{ activity: FeedActivityRow[]; total: num…` — Activity on the caller's content: reactions, comments, saves and reposts on their posts, replies and reactions on their comments, plus posts and comments that mention them. | 198 |
| `countFeedActivity` | function | `async countFeedActivity(userId: string, orgId: string, options: { type?: FeedActivityType; since?: Date \| null } =…): Promise<number>` — How many activity rows exist, optionally of one type and/or since an instant. | 430 |
| `getUnreadActivityCount` | function | `async getUnreadActivityCount(userId: string, orgId: string): Promise<number>` | 526 |
| `markActivityRead` | function | `async markActivityRead(userId: string, orgId: string): Promise<void>` — Mark everything up to now as read, and drop the cached count. | 549 |

## Interfaces

- **Database (Mongoose models used):**
  - `Post` (server/models/post.model.ts) — reads: `find`, `countDocuments`
  - `PostComment` (server/models/postComment.model.ts) — reads: `find`, `countDocuments`
  - `PostLike` (server/models/postLike.model.ts) — reads: `find`, `countDocuments`
  - `PostBookmark` (server/models/postBookmark.model.ts) — reads: `find`, `countDocuments`
  - `PostRepost` (server/models/postRepost.model.ts) — reads: `find`, `countDocuments`
  - `PostCommentLike` (server/models/postCommentLike.model.ts) — reads: `find`, `countDocuments`
  - `FeedActivityRead` (server/models/feedActivityRead.model.ts) — reads: `findOne`; **writes:** `findOneAndUpdate`

## Dependencies

- **Internal:**
  - `server/models/post.model.ts` — `Post`
  - `server/models/postLike.model.ts` — `PostLike`
  - `server/models/postComment.model.ts` — `PostComment`
  - `server/models/postBookmark.model.ts` — `PostBookmark`
  - `server/models/postRepost.model.ts` — `PostRepost`
  - `server/models/postCommentLike.model.ts` — `PostCommentLike`
  - `server/models/feedActivityRead.model.ts` — `FeedActivityRead`
- **Packages:**
  - `mongoose` — `Types`

## Used by

- `server/routes/feed.ts`
