# `lib/reviews-api.ts`

> Reviews & Ratings API client — connects to the backend /reviews endpoints.

**Kind:** frontend library · **Lines:** 455

<!-- docgen:auto -->

## Purpose
Reviews & Ratings API client — connects to the backend /reviews endpoints.
See garagenew-backend/REVIEWS_RATINGS_API.md for the full contract.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `REVIEW_TARGET_TYPES` | const | `= [ "channel", "course", "product", "workshop", "service", "call", "office", ] as const` | 10 |
| `ReviewTargetType` | type |  | 19 |
| `REVIEW_TARGET_LABELS` | const | `= { channel: "Community", course: "Course", product: "Digital Product", workshop: "Worksh…` — Plural labels for the moderation filter chips and row captions. | 22 |
| `ReviewStatus` | type |  | 32 |
| `ReviewVoteValue` | type |  | 33 |
| `ReviewSort` | type |  | 34 |
| `StarKey` | type |  | 36 |
| `RatingSummary` | interface |  | 38 |
| `Review` | interface |  | 54 |
| `ReviewListResult` | interface |  | 86 |
| `emptySummary` | function | `emptySummary(targetType: ReviewTargetType, targetId: string): RatingSummary` — A zeroed summary — used before the first load and for targets with no reviews. | 95 |
| `getRatingSummaries` | function | `async getRatingSummaries(targetType: ReviewTargetType, targetIds: string[]): Promise<Record<string, RatingSummary>>` — Batched summaries for a grid of cards — one round trip for the whole Discover page instead of one request per card. | 148 |
| `getRatingSummary` | function | `async getRatingSummary(targetType: ReviewTargetType, targetId: string): Promise<RatingSummary>` | 165 |
| `ListReviewsParams` | interface |  | 178 |
| `listReviews` | function | `async listReviews(targetType: ReviewTargetType, targetId: string, params: ListReviewsParams = {}): Promise<ReviewListResult>` | 187 |
| `ReviewIneligibleReason` | type |  | 214 |
| `ReviewEligibility` | interface |  | 220 |
| `MyReviewResult` | interface |  | 228 |
| `getMyReview` | function | `async getMyReview(targetType: ReviewTargetType, targetId: string): Promise<MyReviewResult>` — The signed-in user's own review plus whether they may write one. | 250 |
| `NO_REVIEW_ACCESS` | const | `= { review: null, canReview: false, eligibility: DENIED_ELIGIBILITY, }` — Signed-out / errored callers get a safe "cannot review" result. | 269 |
| `SubmitReviewInput` | interface |  | 275 |
| `createReview` | function | `async createReview(targetType: ReviewTargetType, targetId: string, input: SubmitReviewInput): Promise<Review>` | 282 |
| `updateReview` | function | `async updateReview(reviewId: string, input: Partial<SubmitReviewInput>): Promise<Review>` | 294 |
| `deleteReview` | function | `async deleteReview(reviewId: string): Promise<void>` | 305 |
| `removeReviewComment` | function | `async removeReviewComment(reviewId: string): Promise<Review>` — Take down a review's comment text and every attached screenshot, keeping the star rating — the founder's moderation action, and the author's own "unsay it but keep my score" path. | 320 |
| `ModerationReview` | interface | A moderation-queue row: a review plus what it's attached to. | 337 |
| `ListOrgReviewsParams` | interface |  | 342 |
| `OrgReviewsResult` | interface |  | 350 |
| `listOrgReviews` | function | `async listOrgReviews(orgId: string, params: ListOrgReviewsParams = {}): Promise<OrgReviewsResult>` — Every review across one org, newest first — the founder's cross-product view. | 363 |
| `VoteResult` | interface |  | 387 |
| `voteOnReview` | function | `async voteOnReview(reviewId: string, vote: ReviewVoteValue \| null): Promise<VoteResult>` — Set, switch or clear the caller's Helpful / Unhelpful vote. | 397 |
| `RATING_LABELS` | const | `= { 1: "Poor", 2: "Fair", 3: "Good", 4: "Very Good", 5: "Excellent", }` — Label beside the stars in the write-review modal: "Excellent (5/5)". | 415 |
| `formatRelativeTime` | function | `formatRelativeTime(iso: string): string` — "2 hours ago" / "3 days ago" — the timestamp under a reviewer's name. | 424 |
| `formatReviewCount` | function | `formatReviewCount(count: number): string` — "1,284 reviews" | 452 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/${endpoint}` (L120)
- **Environment variables (`process.env`):** `NEXT_PUBLIC_API_URL`

## Dependencies

- **Internal:**
  - `lib/auth.ts` — `getToken`
- **Packages:** none

## Used by

- `components/dashboard/ChannelsPage.tsx`
- `components/dashboard/CoursesPage.tsx`
- `components/dashboard/ProductsPage.tsx`
- `components/dashboard/RightPanel.tsx`
- `components/reviews/CardRatingRow.tsx`
- `components/reviews/RateOfficesForm.tsx`
- `components/reviews/RatingBreakdown.tsx`
- `components/reviews/RatingsReviewsCard.tsx`
- `components/reviews/ReviewCard.tsx`
- `components/reviews/ReviewFormFields.tsx`
- `components/reviews/ReviewsModerationList.tsx`
- `components/reviews/ReviewsPanel.tsx`
- `components/reviews/WriteReviewDialog.tsx`
- `components/reviews/openReviewsPanel.ts`
- `components/reviews/targetIcons.ts`
- `lib/hooks/useRatingSummaries.ts`
