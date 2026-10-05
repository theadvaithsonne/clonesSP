import { Router, Request, Response } from "express";
import { z } from "zod";
import { requireAuth, softAuth } from "../middleware/auth";
import {
  REVIEW_TARGET_TYPES,
  REVIEW_STATUSES,
  ReviewTargetType,
  MAX_REVIEW_IMAGES,
  MAX_REVIEW_TITLE,
  MAX_REVIEW_BODY,
  countReviewChars,
} from "../models/review.model";
import { REVIEW_VOTE_VALUES } from "../models/reviewVote.model";
import {
  ReviewError,
  createReview,
  updateReview,
  deleteReview,
  removeReviewComment,
  listReviews,
  getMyReview,
  getReviewEligibility,
  getRatingSummary,
  getRatingSummaries,
  voteOnReview,
  moderateReview,
  listOrgReviews,
  isUserFounder,
  isReviewTargetType,
  resolveTargetOrg,
  MAX_SUMMARY_BATCH,
  MAX_PAGE_SIZE,
  ReviewSort,
} from "../services/review";

const router = Router();

/**
 * Reviews + ratings.
 *
 * Reads use `softAuth` so guest pages (the public channel page, Discover) can
 * render ratings without a token, while a signed-in caller additionally gets
 * `isMine` / `viewerHasMarkedHelpful` on each row. Writes use `requireAuth`.
 *
 * Route order matters: the static prefixes (`/targets`, `/summaries`,
 * `/moderation`) are declared before the `/:reviewId` routes.
 */

// ============= Helpers =============

/** Translate a service-layer error into an HTTP response. */
function fail(res: Response, error: unknown, fallback: string) {
  if (error instanceof ReviewError) {
    return res.status(error.status).json({ success: false, error: error.message });
  }
  if (error instanceof z.ZodError) {
    return res.status(400).json({
      success: false,
      error: "Invalid request",
      details: error.issues.map((i) => ({
        path: i.path.join("."),
        message: i.message,
      })),
    });
  }
  console.error(`[reviews] ${fallback}:`, error);
  return res.status(500).json({
    success: false,
    error: fallback,
    details: (error as Error)?.message,
  });
}

/** Validate the `:targetType` path param. */
function parseTargetType(value: string): ReviewTargetType {
  if (!isReviewTargetType(value)) {
    throw new ReviewError(
      `Unknown target type "${value}" — expected one of: ${REVIEW_TARGET_TYPES.join(", ")}`,
      400
    );
  }
  return value;
}

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).optional(),
});

// ============= Batched summaries (Discover grid) =============

/**
 * POST /reviews/summaries
 * Body: { targetType, targetIds: string[] }
 *
 * One round trip for a whole grid of cards. POST rather than GET because a
 * Discover page can hold more ids than fit comfortably in a query string.
 * Ids with no reviews come back zeroed, so the caller can map 1:1.
 */
router.post("/summaries", softAuth, async (req: Request, res: Response) => {
  try {
    const { targetType, targetIds } = z
      .object({
        targetType: z.string(),
        targetIds: z.array(z.string()).max(MAX_SUMMARY_BATCH),
      })
      .parse(req.body);

    const summaries = await getRatingSummaries(
      parseTargetType(targetType),
      targetIds
    );

    res.json({ success: true, summaries });
  } catch (error) {
    return fail(res, error, "Failed to get rating summaries");
  }
});

// ============= Per-target reads =============

/**
 * GET /reviews/targets/:targetType/:targetId
 * Query: page, limit, sort=recent|helpful|highest|lowest, rating, verifiedOnly
 *
 * Returns the page of reviews AND the full rating summary (average, per-star
 * counts and percentages) so a detail page renders from one request.
 */
router.get(
  "/targets/:targetType/:targetId",
  softAuth,
  async (req: Request, res: Response) => {
    try {
      const targetType = parseTargetType(req.params.targetType);
      const { targetId } = req.params;

      const query = paginationSchema
        .extend({
          sort: z.enum(["recent", "helpful", "highest", "lowest"]).optional(),
          rating: z.coerce.number().int().min(1).max(5).optional(),
          verifiedOnly: z
            .enum(["true", "false"])
            .optional()
            .transform((v) => v === "true"),
          includeHidden: z
            .enum(["true", "false"])
            .optional()
            .transform((v) => v === "true"),
        })
        .parse(req.query);

      const viewerId = (req as any).user?.userId as string | undefined;

      // Hidden reviews are founder-only. Silently downgrade rather than 403 —
      // a member who asks for them just gets the public list.
      let includeHidden = false;
      if (query.includeHidden && viewerId) {
        const orgId = await resolveTargetOrg(targetType, targetId);
        includeHidden = orgId ? await isUserFounder(viewerId, orgId) : false;
      }

      const result = await listReviews(targetType, targetId, {
        page: query.page,
        limit: query.limit,
        sort: query.sort as ReviewSort | undefined,
        rating: query.rating,
        verifiedOnly: query.verifiedOnly,
        includeHidden,
        viewerId,
      });

      res.json({ success: true, ...result });
    } catch (error) {
      return fail(res, error, "Failed to get reviews");
    }
  }
);

/**
 * GET /reviews/targets/:targetType/:targetId/summary
 * Just the numbers — for a card or a header that doesn't list reviews.
 */
router.get(
  "/targets/:targetType/:targetId/summary",
  softAuth,
  async (req: Request, res: Response) => {
    try {
      const summary = await getRatingSummary(
        parseTargetType(req.params.targetType),
        req.params.targetId
      );
      res.json({ success: true, summary });
    } catch (error) {
      return fail(res, error, "Failed to get rating summary");
    }
  }
);

/**
 * GET /reviews/targets/:targetType/:targetId/mine
 *
 * The caller's own review (or null) AND whether they're allowed to write one.
 *
 * Eligibility is returned here rather than inferred by the client because it
 * depends on membership in THIS community — a viewer browsing Discover sees
 * communities they haven't joined and must not be offered the form for them.
 */
router.get(
  "/targets/:targetType/:targetId/mine",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { userId } = (req as any).user;
      const targetType = parseTargetType(req.params.targetType);
      const { targetId } = req.params;

      const [review, eligibility] = await Promise.all([
        getMyReview(userId, targetType, targetId),
        getReviewEligibility(userId, targetType, targetId),
      ]);

      res.json({
        success: true,
        review: review || null,
        // An existing author can always edit their own review, even if their
        // membership has since lapsed.
        canReview: eligibility.canReview || Boolean(review),
        eligibility,
      });
    } catch (error) {
      return fail(res, error, "Failed to get your review");
    }
  }
);

// ============= Write =============

/**
 * POST /reviews/targets/:targetType/:targetId
 * Body: { rating: 1-5, body: string, title?: string }
 *
 * Access is enforced server-side per target type (community membership,
 * course enrolment, paid order, …) — the endpoint never trusts that the client
 * only showed the form to eligible users.
 */
router.post(
  "/targets/:targetType/:targetId",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { userId } = (req as any).user;
      const targetType = parseTargetType(req.params.targetType);

      const body = z
        .object({
          rating: z.number().int().min(1).max(5),
          body: z
            .string()
            .min(1)
            .refine((v) => countReviewChars(v) <= MAX_REVIEW_BODY, {
              message: `Review must be ${MAX_REVIEW_BODY} characters or fewer (spaces not counted)`,
            }),
          title: z.string().max(MAX_REVIEW_TITLE).optional(),
          images: z.array(z.string()).max(MAX_REVIEW_IMAGES).optional(),
        })
        .parse(req.body);

      const review = await createReview({
        userId,
        targetType,
        targetId: req.params.targetId,
        rating: body.rating,
        body: body.body,
        title: body.title,
        images: body.images,
      });

      res.status(201).json({ success: true, review });
    } catch (error) {
      return fail(res, error, "Failed to create review");
    }
  }
);

// ============= Founder moderation queue =============

/**
 * GET /reviews/moderation?orgId=...&status=...&targetType=...
 * Every review across the org. Founder only.
 */
router.get("/moderation", requireAuth, async (req: Request, res: Response) => {
  try {
    const { userId } = (req as any).user;
    const query = paginationSchema
      .extend({
        orgId: z.string(),
        status: z.enum(REVIEW_STATUSES).optional(),
        targetType: z.string().optional(),
      })
      .parse(req.query);

    if (!(await isUserFounder(userId, query.orgId))) {
      return res
        .status(403)
        .json({ success: false, error: "Founders only" });
    }

    const result = await listOrgReviews(query.orgId, {
      status: query.status,
      targetType: query.targetType
        ? parseTargetType(query.targetType)
        : undefined,
      page: query.page,
      limit: query.limit,
    });

    res.json({ success: true, ...result });
  } catch (error) {
    return fail(res, error, "Failed to get reviews for moderation");
  }
});

// ============= Single-review operations =============

/**
 * PATCH /reviews/:reviewId
 * Edit your own review. Any subset of { rating, body, title }.
 */
router.patch("/:reviewId", requireAuth, async (req: Request, res: Response) => {
  try {
    const { userId } = (req as any).user;

    const body = z
      .object({
        rating: z.number().int().min(1).max(5).optional(),
        body: z
            .string()
            .min(1)
            .refine((v) => countReviewChars(v) <= MAX_REVIEW_BODY, {
              message: `Review must be ${MAX_REVIEW_BODY} characters or fewer (spaces not counted)`,
            }).optional(),
        title: z.string().max(MAX_REVIEW_TITLE).optional(),
        images: z.array(z.string()).max(MAX_REVIEW_IMAGES).optional(),
      })
      .parse(req.body);

    const review = await updateReview(req.params.reviewId, userId, body);
    res.json({ success: true, review });
  } catch (error) {
    return fail(res, error, "Failed to update review");
  }
});

/**
 * DELETE /reviews/:reviewId
 * Author deletes their own; a founder can remove any review on their content.
 */
router.delete("/:reviewId", requireAuth, async (req: Request, res: Response) => {
  try {
    const { userId } = (req as any).user;
    const deleted = await deleteReview(req.params.reviewId, userId);

    if (!deleted) {
      return res
        .status(404)
        .json({ success: false, error: "Review not found" });
    }

    res.json({ success: true });
  } catch (error) {
    return fail(res, error, "Failed to delete review");
  }
});

/**
 * DELETE /reviews/:reviewId/comment
 *
 * Take down the written comment and every attached screenshot, keeping the star
 * rating. The author can do it to their own; a founder can do it to any review
 * on their own content.
 *
 * Narrower than DELETE /reviews/:reviewId on purpose — the rating stays in the
 * average, so moderating what someone wrote can't quietly improve the score.
 */
router.delete(
  "/:reviewId/comment",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { userId } = (req as any).user;
      const review = await removeReviewComment(req.params.reviewId, userId);
      res.json({ success: true, review });
    } catch (error) {
      return fail(res, error, "Failed to remove the comment");
    }
  }
);

/**
 * PATCH /reviews/:reviewId/moderate
 * Body: { status: published|pending|hidden, note?: string }
 *
 * Founders can change a review's visibility but never its wording — hiding a
 * review removes it from the public list and from the average.
 */
router.patch(
  "/:reviewId/moderate",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { userId } = (req as any).user;
      const body = z
        .object({
          status: z.enum(REVIEW_STATUSES),
          note: z.string().max(500).optional(),
        })
        .parse(req.body);

      const review = await moderateReview(
        req.params.reviewId,
        userId,
        body.status,
        body.note
      );

      res.json({ success: true, review });
    } catch (error) {
      return fail(res, error, "Failed to moderate review");
    }
  }
);

// ============= Helpful / Unhelpful votes =============

/**
 * PUT /reviews/:reviewId/vote
 * Body: { vote: "helpful" | "unhelpful" | null }
 *
 * Drives the "Was this helpful? [Helpful (12)] [Unhelpful]" pair. `null`
 * clears the vote, which is what tapping the already-active button does.
 * Idempotent in every direction; returns both counters and the caller's
 * resulting vote so the UI can render from the response alone.
 */
router.put(
  "/:reviewId/vote",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { userId } = (req as any).user;
      const { vote } = z
        .object({
          vote: z.enum(REVIEW_VOTE_VALUES).nullable(),
        })
        .parse(req.body);

      const result = await voteOnReview(req.params.reviewId, userId, vote);
      res.json({ success: true, ...result });
    } catch (error) {
      return fail(res, error, "Failed to record your vote");
    }
  }
);

export default router;
