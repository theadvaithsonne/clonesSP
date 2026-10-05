# `server/services/review.ts`

> Module exporting `ownerMayReview`, `ensureReviewIndexes`, `isUserFounder`, `isReviewTargetType` and 17 more.

**Kind:** backend service · **Lines:** 1640

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `REVIEW_AVERAGE_EXCLUDES_OWNER` | const | `= true` — Founders bypass the access gate — it's their own community/course/product, and they already bypass channel membership everywhere else in the feed. | 45 |
| `ownerMayReview` | function | `ownerMayReview(targetType: ReviewTargetType): boolean` — May a founder of the owning org review this target type at all? | 60 |
| `MAX_SUMMARY_BATCH` | const | `= 200` — Upper bound on ids accepted by the batched summary read. | 65 |
| `ensureReviewIndexes` | function | `async ensureReviewIndexes(): Promise<void>` — Synchronize and clean indexes on reviews and ratingsummaries collections. | 71 |
| `ReviewError` | class | `extends Error` — Anything the caller got wrong. | 114 |
| `isUserFounder` | function | `async isUserFounder(userId: string \| Types.ObjectId, orgId: string \| Types.ObjectId): Promise<boolean>` — Same rule as `routes/feed.ts:isUserFounder` — the legacy single-org role plus the multi-org membership array, with stakeholder `fullAccess` counting as founder access. | 133 |
| `TargetAccess` | interface |  | 164 |
| `isReviewTargetType` | function | `isReviewTargetType(value: string): value is ReviewTargetType` | 381 |
| `resolveTargetOrg` | function | `async resolveTargetOrg(targetType: ReviewTargetType, targetId: string): Promise<Types.ObjectId \| null>` — The org that owns a target, or null if the target doesn't exist. | 392 |
| `ReviewEligibility` | interface |  | 410 |
| `assertCanReview` | function | `async assertCanReview(userId: string, targetType: ReviewTargetType, targetId: string): Promise<ReviewEligibility>` — Resolve the owning org and decide whether this user may review the target. | 422 |
| `ReviewIneligibleReason` | type |  | 465 |
| `ReviewEligibilityResult` | interface |  | 471 |
| `getReviewEligibility` | function | `async getReviewEligibility(userId: string, targetType: ReviewTargetType, targetId: string): Promise<ReviewEligibilityResult>` — Non-throwing counterpart to `assertCanReview`, for deciding whether to SHOW the write-a-review button. | 496 |
| `recomputeRatingSummary` | function | `async recomputeRatingSummary(targetType: ReviewTargetType, targetId: Types.ObjectId \| string, organizationId: Types.ObjectId \| string, session?: ClientSession): Promise<void>` — Rebuild the denormalized aggregate for one target from the Review collection, in full. | 557 |
| `StarKey` | type |  | 675 |
| `RatingSummaryPayload` | interface |  | 677 |
| `toSummaryPayload` | function | `toSummaryPayload(targetType: ReviewTargetType, targetId: string, summary: StoredSummary \| null): RatingSummaryPayload` — Shape a stored summary — or a missing one — into the API payload. | 709 |
| `getRatingSummary` | function | `async getRatingSummary(targetType: ReviewTargetType, targetId: string): Promise<RatingSummaryPayload>` | 750 |
| `getRatingSummaries` | function | `async getRatingSummaries(targetType: ReviewTargetType, targetIds: string[]): Promise<Record<string, RatingSummaryPayload>>` — Batched summary read for grid views — the Discover community cards fetch every rating in one round trip instead of one query per card. | 771 |
| `CreateReviewInput` | interface |  | 900 |
| `createReview` | function | `async createReview(input: CreateReviewInput): Promise<IReview>` | 910 |
| `UpdateReviewInput` | interface |  | 1036 |
| `updateReview` | function | `async updateReview(reviewId: string, userId: string, input: UpdateReviewInput): Promise<IReview>` — Edit your own review. | 1047 |
| `deleteReview` | function | `async deleteReview(reviewId: string, userId: string): Promise<boolean>` — Delete a review. The author can always delete their own; a founder of the owning org can delete any review on their own content. | 1125 |
| `removeReviewComment` | function | `async removeReviewComment(reviewId: string, userId: string): Promise<IReview>` — Take down a review's written content — the comment text and every attached screenshot — while leaving the star rating standing. | 1181 |
| `ReviewSort` | type |  | 1228 |
| `ListReviewsOptions` | interface |  | 1230 |
| `MAX_PAGE_SIZE` | const | `= 100` | 1253 |
| `listReviews` | function | `async listReviews(targetType: ReviewTargetType, targetId: string, options: ListReviewsOptions = {}): Promise<{ reviews: any[]; total: number; page: nu…` | 1255 |
| `getMyReview` | function | `async getMyReview(userId: string, targetType: ReviewTargetType, targetId: string): Promise<IReview \| null>` — The signed-in user's own review of a target, if any. | 1326 |
| `ReviewVoteResult` | interface |  | 1343 |
| `voteOnReview` | function | `async voteOnReview(reviewId: string, userId: string, vote: ReviewVoteValue \| null): Promise<ReviewVoteResult>` — Set, switch, or clear the caller's vote on a review. | 1369 |
| `recountReviewVotes` | function | `async recountReviewVotes(reviewId: Types.ObjectId \| string): Promise<{ helpfulCount: number; notHelpfulCount: …` — Rebuild a review's vote counters from the ReviewVote rows. | 1473 |
| `moderateReview` | function | `async moderateReview(reviewId: string, founderId: string, status: ReviewStatus, note?: string): Promise<IReview>` | 1496 |
| `listOrgReviews` | function | `async listOrgReviews(organizationId: string, options: { status?: ReviewStatus; targetType?: ReviewTarget…): Promise<{ reviews: any[]; total: number; page: nu…` — Org-wide moderation queue — every review across every product type the org owns, newest first. | 1596 |

## Interfaces

- **Database (Mongoose models used):**
  - `Review` (server/models/review.model.ts) — reads: `aggregate`, `findOne`, `findById`, `countDocuments`, `find`; **writes:** `createIndexes`, `create`, `deleteOne`, `findByIdAndUpdate`, `updateOne`
  - `RatingSummary` (server/models/ratingSummary.model.ts) — reads: `findOne`, `find`; **writes:** `createIndexes`, `updateOne`, `create`
  - `User` (server/models/user.model.ts) — reads: `findById`, `findOne`
  - `Channel` (server/models/channel.model.ts) — reads: `findById`
  - `ChannelMembership` (server/models/channelMembership.model.ts) — reads: `findOne`
  - `Course` (server/models/course.model.ts) — reads: `findById`
  - `CourseEnrollment` (server/models/courseEnrollment.model.ts) — reads: `findOne`
  - `Product` (server/models/product.model.ts) — reads: `findById`
  - `ProductOrder` (server/models/productOrder.model.ts) — reads: `findOne`
  - `Workshop` (server/models/workshop.model.ts) — reads: `findById`
  - `WorkshopRegistration` (server/models/workshopRegistration.model.ts) — reads: `findOne`
  - `Service` (server/models/service.model.ts) — reads: `findById`
  - `ServiceOpt` (server/models/serviceOpt.model.ts) — reads: `findOne`
  - `CallOffering` (server/models/callOffering.model.ts) — reads: `findById`
  - `CallPurchase` (server/models/callPurchase.model.ts) — reads: `findOne`
  - `Organization` (server/models/organization.model.ts) — reads: `findById`
  - `ReviewVote` (server/models/reviewVote.model.ts) — reads: `find`, `aggregate`; **writes:** `deleteMany`, `findOneAndDelete`, `findOneAndUpdate`, `updateOne`
- **Raw collections:** `reviews`

## Dependencies

- **Internal:**
  - `server/models/review.model.ts` — `Review`, `IReview`, `ReviewTargetType`, `ReviewStatus`, `MAX_REVIEW_IMAGES`, `MAX_REVIEW_BODY`, `countReviewChars`
  - `server/models/ratingSummary.model.ts` — `RatingSummary`, `IStarCounts`, `EMPTY_STAR_COUNTS`
  - `server/models/reviewVote.model.ts` — `ReviewVote`, `ReviewVoteValue`
  - `server/models/user.model.ts` — `User`
  - `server/utils/accessCheck.ts` — `hasFounderAccess`
  - `server/utils/plainText.ts` — `toPlainText`, `toPlainSingleLine`
  - `server/models/channel.model.ts` — `Channel`
  - `server/models/channelMembership.model.ts` — `ChannelMembership`
  - `server/models/course.model.ts` — `Course`
  - `server/models/courseEnrollment.model.ts` — `CourseEnrollment`
  - `server/models/product.model.ts` — `Product`
  - `server/models/productOrder.model.ts` — `ProductOrder`
  - `server/models/workshop.model.ts` — `Workshop`
  - `server/models/workshopRegistration.model.ts` — `WorkshopRegistration`
  - `server/models/service.model.ts` — `Service`
  - `server/models/serviceOpt.model.ts` — `ServiceOpt`
  - `server/models/callOffering.model.ts` — `CallOffering`
  - `server/models/callPurchase.model.ts` — `CallPurchase`
  - `server/models/organization.model.ts` — `Organization`
- **Packages:**
  - `mongoose` — `ClientSession`, `Types`

## Used by

- `server/index.ts`
- `server/routes/evergreen.ts`
- `server/routes/review.ts`
- `server/routes/simulatedAudience.ts`
- `server/scripts/rebuild-rating-summaries.ts`

## Notes

- Large file (1640 lines) — read it by section; line numbers above point into it.
