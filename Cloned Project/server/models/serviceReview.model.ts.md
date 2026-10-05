# `server/models/serviceReview.model.ts`

> Legacy Mongoose model for a star review of a `Service`, left by a user whose opt-in to that service is completed.

**Kind:** Mongoose model · **Lines:** 113

## Purpose
Before the polymorphic `Review` collection (`review.model.ts`) existed, services had their own review model. The `Review` model's header says it replaces `ServiceReview`, but this model is still wired into the service routes, so both systems currently exist side by side.

## How it works
- References: `serviceId` (ref `Service`, indexed), `serviceOptId` (ref `ServiceOpt`, the specific engagement), `userId` (ref `User`, indexed), `organizationId` (ref `Organization`, indexed) - all required.
- Content: `rating` (1-5, required; integers are not enforced), `comment` (required, trimmed).
- Reviewer snapshot for display: `reviewerName` (required), `reviewerRole`, `reviewerAvatar`.
- Moderation: `isApproved` (default `true` - auto-approved) and `isPublic` (default `true` - may appear on public pages).
- Indexes: `{ serviceId, userId }` unique (one review per user per service), `{ serviceId, isApproved, isPublic }` (approved public reviews), `{ serviceId, isPublic, createdAt: -1 }` (newest first).

## Exports
- `ServiceReview` - model `"ServiceReview"` (collection `servicereviews`).
- `IServiceReview` - document interface.

## Interfaces
- **Database:** `ServiceReview` (collection `servicereviews`) - schema only.

## Dependencies
- **Packages:** `mongoose` - schema and model.

## Used by
`server/services/service.ts` - `createReview()` (only allowed when the user's `ServiceOpt` for that service has status `completed`, and rejects duplicates) and `getServiceReviews()` (paginated list plus an average-rating aggregation). These back `POST /:serviceId/reviews` and `GET /:serviceId/reviews` in `server/routes/service.ts` (browser: `/backend/services/:serviceId/reviews`).

## Notes
- Ratings written here do not feed `RatingSummary`; the polymorphic `Review` system (target type `"service"`) is separate. Check which one a given UI reads before changing either.
