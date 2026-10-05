# `server/models/poll.model.ts`

> Mongoose model for a poll attached to a community feed post, with denormalised per-option vote counts.

**Kind:** Mongoose model · **Lines:** 61

## Purpose
A community feed post (`post.model.ts`) can carry a poll. The post sets `hasPoll: true` and the poll itself lives here, one per post. Vote counts are stored on the poll so the feed can render results without counting votes; individual votes are in `pollVote.model.ts`.

## How it works
- **Fields:**
  - `postId` (ref `Post`, required, unique, indexed) - one poll per post.
  - `orgId` (ref `Organization`, required, indexed).
  - `question` (required, max 280).
  - `options[]` - each `{ text (required, max 100), votesCount (default 0, min 0) }` with an auto `_id` that votes reference.
  - `totalVotes` (default 0), `endsAt` (required), `isMultipleChoice` (default `false`), `isActive` (default `true`), `timestamps`.
- **Index:** `{ orgId, isActive, endsAt }` for finding an org's active polls.

## Exports
- `IPollOption` - option interface (`_id`, `text`, `votesCount`).
- `IPoll` - document interface.
- `Poll` - the Mongoose model.

## Interfaces
- **Database:** `Poll` (collection `polls`).

## Dependencies
- **Packages:** `mongoose`.

## Used by
- `server/services/feed.ts` - loads polls for posts with `hasPoll` (batch `Poll.find({ postId: { $in } })` and single `findOne`) together with the viewer's `PollVote`.
- `server/routes/public.ts` (mounted at `/public`) - includes the poll in public post views.

## Notes
- `votesCount` and `totalVotes` are counters maintained by the service, not recomputed from `PollVote`; they can drift if a write path updates one side only.
- `endsAt` does not flip `isActive` automatically; callers compare against the current time.
