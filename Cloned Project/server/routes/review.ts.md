# `server/routes/review.ts`

> Express router with 11 endpoints, mounted at `/reviews`.

**Kind:** Express router · **Lines:** 465 · **Mounted at:** `/reviews` (browser: `/backend/reviews`)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (11)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| POST | `/summaries` | `/backend/reviews/summaries` | `softAuth` | inline | 100 |
| GET | `/targets/:targetType/:targetId` | `/backend/reviews/targets/:targetType/:targetId` | `softAuth` | inline | 129 |
| GET | `/targets/:targetType/:targetId/summary` | `/backend/reviews/targets/:targetType/:targetId/summary` | `softAuth` | inline | 183 |
| GET | `/targets/:targetType/:targetId/mine` | `/backend/reviews/targets/:targetType/:targetId/mine` | `requireAuth` | inline | 208 |
| POST | `/targets/:targetType/:targetId` | `/backend/reviews/targets/:targetType/:targetId` | `requireAuth` | inline | 246 |
| GET | `/moderation` | `/backend/reviews/moderation` | `requireAuth` | inline | 291 |
| PATCH | `/:reviewId` | `/backend/reviews/:reviewId` | `requireAuth` | inline | 329 |
| DELETE | `/:reviewId` | `/backend/reviews/:reviewId` | `requireAuth` | inline | 358 |
| DELETE | `/:reviewId/comment` | `/backend/reviews/:reviewId/comment` | `requireAuth` | inline | 385 |
| PATCH | `/:reviewId/moderate` | `/backend/reviews/:reviewId/moderate` | `requireAuth` | inline | 406 |
| PUT | `/:reviewId/vote` | `/backend/reviews/:reviewId/vote` | `requireAuth` | inline | 444 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 464 |

## Interfaces

- **Database (Mongoose models used):**
  - `REVIEW_TARGET_TYPES` (server/models/review.model.ts) — referenced

## Dependencies

- **Internal:**
  - `server/middleware/auth.ts` — `requireAuth`, `softAuth`
  - `server/models/review.model.ts` — `REVIEW_TARGET_TYPES`, `REVIEW_STATUSES`, `ReviewTargetType`, `MAX_REVIEW_IMAGES`, `MAX_REVIEW_TITLE`, `MAX_REVIEW_BODY`, `countReviewChars`
  - `server/models/reviewVote.model.ts` — `REVIEW_VOTE_VALUES`
  - `server/services/review.ts` — `ReviewError`, `createReview`, `updateReview`, `deleteReview`, `removeReviewComment`, `listReviews`, `getMyReview`, `getReviewEligibility`, … +11
- **Packages:**
  - `express` — `Router`, `Request`, `Response`
  - `zod` — `z`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/reviews`.
