# `server/models/review.model.ts`

> Mongoose model for the single polymorphic review collection (communities, courses, products, workshops, services, calls and organisations), plus the shared limits and character-count rule for review text.

**Kind:** Mongoose model · **Lines:** 230

## Purpose
Ratings used to be copy-pasted per feature (`Channel.reviews[]`, `Course.reviews[]`, `Product.reviews[]`, `Workshop.reviews[]`, the `ServiceReview` model). This model replaces that with one collection keyed by `(targetType, targetId)`. Adding ratings to a new feature means adding a target type and an access gate in `server/services/review.ts` - no new model or routes. The founder-authored `rating` / `ratingCount` / `reviews[]` fields still on the Channel/Course/Product/Workshop documents are left alone as a manual override; `RatingSummary` (built from this collection) is the source of truth for real user ratings.

## How it works

### Constants and helper
- `REVIEW_TARGET_TYPES` - `channel` (a community), `course`, `product`, `workshop`, `service`, `call`, `office` (the organisation itself, rated by people who joined it).
- `REVIEW_STATUSES` - `published`, `pending`, `hidden`.
- `MAX_REVIEW_IMAGES = 6`, `MAX_REVIEW_TITLE = 140`, `MAX_REVIEW_BODY = 500`. These are exported so route validators and the schema cannot drift; the frontend mirrors them in `WriteReviewDialog.tsx`.
- `countReviewChars(value)` - length with all whitespace removed. The body cap counts only visible characters, so padding with spaces cannot burn the allowance, and the stored string keeps its whitespace. The frontend counter uses the same rule.

### Fields
- **Target:** `targetType` (enum), `targetId`, `organizationId` (ref `Organization`, indexed).
- **Author:** `userId` (ref `User`), plus a denormalised reviewer snapshot `reviewerName` (required), `reviewerRole`, `reviewerAvatar` so listings never need a `$lookup` into `User`; refreshed on edit.
- **Content:** `rating` (1-5, must be an integer), `title` (trimmed, max 140), `body` (default `""`, trimmed, validated with `countReviewChars <= 500` rather than `maxlength`), `images[]` (already-uploaded URLs, at most 6 - no binary data stored).
- **Signals:** `isVerifiedPurchase` (access traced to a payment rather than a free join / auto-join / founder bypass; a badge, not a gate), `isOwnerReview` (written by a founder of the owning org; allowed, but flagged so it stays visible).
- **Votes:** `helpfulCount`, `notHelpfulCount` - denormalised tallies; the authoritative per-user votes are in `ReviewVote`.
- **Moderation:** `status` (default `published`), `moderatedBy`, `moderatedAt`, `moderationNote`; `commentRemovedAt` / `commentRemovedBy` mark a take-down that removed the text and images but kept the rating (`removeReviewComment` in the service), so the UI can say "comment removed" instead of showing a blank.
- `editedAt`, timestamps.

### Indexes
- `{ targetType, targetId, userId }` unique - one review per user per target.
- `{ targetType, targetId, status, createdAt: -1 }` - newest first (default listing).
- `{ targetType, targetId, status, helpfulCount: -1 }` - most helpful first.
- `{ targetType, targetId, status, rating }` - filter by star value.
- `{ organizationId, status, createdAt: -1 }` - founder moderation queue across an org.
- `{ userId, createdAt: -1 }` - "my reviews" and clean-up when a user is removed.

## Exports
- `Review` - model `"Review"` (collection `reviews`).
- `IReview` - document interface.
- `REVIEW_TARGET_TYPES`, `ReviewTargetType` - target types and their union type.
- `REVIEW_STATUSES`, `ReviewStatus` - statuses and their union type.
- `MAX_REVIEW_IMAGES`, `MAX_REVIEW_TITLE`, `MAX_REVIEW_BODY` - limits.
- `countReviewChars(value: string): number` - whitespace-free length used for the body cap.

## Interfaces
- **Database:** `Review` (collection `reviews`) - schema only; reads and writes happen in `server/services/review.ts`.

## Dependencies
- **Packages:** `mongoose` - schema and model.

## Used by
- `server/routes/review.ts` - mounted at `/reviews` (browser: `/backend/reviews`): batch `POST /summaries`, per-target `GET`/`POST /targets/:targetType/:targetId` (plus `/summary` and `/mine`), `GET /moderation`, `PATCH`/`DELETE /:reviewId`, `DELETE /:reviewId/comment`, `PATCH /:reviewId/moderate`, `PUT /:reviewId/vote`.
- `server/services/review.ts` - access gates, writes, summary recompute.
- `server/models/ratingSummary.model.ts` - reuses `REVIEW_TARGET_TYPES`.
- `server/services/downlineMemberLiveStreams.ts`, `server/services/downlineMemberPurchases.ts` - read reviews for downline reports.
- `server/scripts/rebuild-rating-summaries.ts` - manual repair script.

## Notes
- `body` is intentionally not `required`: a moderated review legitimately has an empty body. Non-empty bodies are enforced on the user-input write paths (the route's zod schema and `normalizeContent` in the service).
