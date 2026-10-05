# `server/models/ratingSummary.model.ts`

> Mongoose model for a denormalised star-rating aggregate, one row per reviewed item (`targetType` + `targetId`).

**Kind:** Mongoose model · **Lines:** 122

## Purpose
The Discover grid shows a star rating and review count on every community (and other reviewable item) card. Computing that with a `$group` over the `Review` collection per card would be slow, so this collection keeps a pre-computed summary that can be read for many cards in one batched query. It is rebuilt in full by `recomputeRatingSummary()` (in `server/services/review.ts`) inside the same transaction as every review write, so it cannot drift from the underlying reviews.

## How it works
- **Key:** `targetType` (enum `REVIEW_TARGET_TYPES` from `review.model.ts`), `targetId`, and `organizationId` (ref `Organization`) of the owning org.
- **Aggregates:** `average` (0-5, mean of counted reviews to 2 dp, 0 when there are none), `count`, `distribution` (sub-document `star1`..`star5`, each >= 0), `verifiedCount` (reviews whose access traced to a payment), `ownerReviewCount` (reviews written by a founder of the owning org - excluded from `average`/`count` when `REVIEW_AVERAGE_EXCLUDES_OWNER` is on in `services/review.ts`, but tracked so the exclusion is visible; always 0 for target types founders cannot review, per `OWNER_CANNOT_REVIEW`), `lastReviewAt`, timestamps.
- **Why `star1`..`star5`:** numeric keys such as `distribution.1` are ambiguous with array-index paths in Mongo updates; named fields keep update paths unambiguous. `toSummaryPayload()` in `services/review.ts` maps them back to `1`..`5` for clients.
- **Indexes:**
  - `{ targetType, targetId }` unique - one summary per target; also the lookup key for the batched read, and the document whose write conflict serialises concurrent recomputes.
  - `{ organizationId, targetType, average: -1 }` - "top rated communities in this org".
- `EMPTY_STAR_COUNTS` is the zeroed distribution used as the default (spread into a fresh object each time).

## Exports
- `RatingSummary` - model `"RatingSummary"` (collection `ratingsummaries`).
- `IRatingSummary` - document interface.
- `IStarCounts` - `star1`..`star5` counts.
- `EMPTY_STAR_COUNTS` - all-zero `IStarCounts`.

## Interfaces
- **Database:** `RatingSummary` (collection `ratingsummaries`) - schema only; written by `recomputeRatingSummary()`.

## Dependencies
- **Internal:** `server/models/review.model.ts` - `REVIEW_TARGET_TYPES` and `ReviewTargetType`.
- **Packages:** `mongoose` - schema and model.

## Used by
`server/services/review.ts` (recompute and read), `server/scripts/rebuild-rating-summaries.ts` (manual repair script).

## Notes
- Because the recompute is a full rebuild rather than an increment, any row can be repaired at any time without knowing its history. The header comment calls the repair script `scripts/backfill-rating-summaries.ts`; the file that actually exists is `server/scripts/rebuild-rating-summaries.ts`.
