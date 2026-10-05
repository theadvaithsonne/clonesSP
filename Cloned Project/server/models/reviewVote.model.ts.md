# `server/models/reviewVote.model.ts`

> Mongoose model with one row per (review, user) recording whether that user found a review "helpful" or "unhelpful".

**Kind:** Mongoose model · **Lines:** 65

## Purpose
The review UI offers "Helpful" and "Unhelpful" as a toggle pair, so a vote is tri-state: helpful, unhelpful, or absent (the row is deleted). Votes live in their own collection rather than as arrays on `Review` so that a replayed request cannot inflate a counter (the unique index is the idempotency guard), and so "how did I vote on these 20 reviews?" is one indexed query. `Review.helpfulCount` / `Review.notHelpfulCount` are denormalised tallies of these rows.

## How it works
- Fields: `reviewId` (ref `Review`), `userId` (ref `User`), `vote` (`"helpful"` | `"unhelpful"`), all required; timestamps.
- Indexes:
  - `{ reviewId, userId }` unique - one vote per user per review; switching helpful to unhelpful updates the existing row.
  - `{ userId, reviewId }` - "how did I vote on this page of reviews?".
  - `{ reviewId, vote }` - powers the recount aggregation.
- In `server/services/review.ts`, `voteOnReview()` upserts or deletes the row and adjusts the review's counters by a delta computed from the row's previous value (floored at 0); `recountReviewVotes()` rebuilds the counters from this collection if they drift.

## Exports
- `ReviewVote` - model `"ReviewVote"` (collection `reviewvotes`).
- `IReviewVote` - document interface.
- `REVIEW_VOTE_VALUES` - `["helpful", "unhelpful"]`.
- `ReviewVoteValue` - union type of those values.

## Interfaces
- **Database:** `ReviewVote` (collection `reviewvotes`) - schema only.

## Dependencies
- **Packages:** `mongoose` - schema and model.

## Used by
- `server/services/review.ts` - `voteOnReview()`, `recountReviewVotes()`, and per-user vote lookups for listings.
- `server/routes/review.ts` - mounted at `/reviews`; `PUT /:reviewId/vote` (browser: `/backend/reviews/:reviewId/vote`) casts or clears a vote.
