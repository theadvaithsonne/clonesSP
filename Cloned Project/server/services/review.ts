import mongoose, { ClientSession, Types } from "mongoose";
import {
  Review,
  IReview,
  ReviewTargetType,
  ReviewStatus,
  MAX_REVIEW_IMAGES,
  MAX_REVIEW_BODY,
  countReviewChars,
} from "../models/review.model";
import {
  RatingSummary,
  IStarCounts,
  EMPTY_STAR_COUNTS,
} from "../models/ratingSummary.model";
import { ReviewVote, ReviewVoteValue } from "../models/reviewVote.model";
import { User } from "../models/user.model";
import { hasFounderAccess } from "../utils/accessCheck";
import { toPlainText, toPlainSingleLine } from "../utils/plainText";

// Targets + their access gates
import { Channel } from "../models/channel.model";
import { ChannelMembership } from "../models/channelMembership.model";
import { Course } from "../models/course.model";
import { CourseEnrollment } from "../models/courseEnrollment.model";
import { Product } from "../models/product.model";
import { ProductOrder } from "../models/productOrder.model";
import { Workshop } from "../models/workshop.model";
import { WorkshopRegistration } from "../models/workshopRegistration.model";
import { Service } from "../models/service.model";
import { ServiceOpt } from "../models/serviceOpt.model";
import { CallOffering } from "../models/callOffering.model";
import { CallPurchase } from "../models/callPurchase.model";
import { Organization } from "../models/organization.model";

/**
 * Founders bypass the access gate — it's their own community/course/product,
 * and they already bypass channel membership everywhere else in the feed. But
 * a founder rating their own product is a self-rating, so those reviews are
 * kept OUT of the public average and count. They are still stored, still
 * listed, and tallied separately as `ownerReviewCount`.
 *
 * Flip this to `false` to have owner reviews count like any other.
 */
export const REVIEW_AVERAGE_EXCLUDES_OWNER = true;

/**
 * Target types the owner may not review at all — a hard 403, not a bypass.
 *
 * An office is its founder's own house. Letting them file a rating on it, even
 * one quietly kept out of the average, puts a self-authored review in the list
 * under a "Founder" byline, which is exactly the impression an office rating
 * exists to avoid. For the things a founder *sells* the softer rule still
 * applies: they may write one, it's flagged `isOwnerReview` and excluded from
 * the average.
 */
const OWNER_CANNOT_REVIEW: ReadonlySet<ReviewTargetType> = new Set(["office"]);

/** May a founder of the owning org review this target type at all? */
export function ownerMayReview(targetType: ReviewTargetType): boolean {
  return !OWNER_CANNOT_REVIEW.has(targetType);
}

/** Upper bound on ids accepted by the batched summary read. */
export const MAX_SUMMARY_BATCH = 200;

/**
 * Synchronize and clean indexes on reviews and ratingsummaries collections.
 * Automatically drops stale/conflicting unique indexes (such as unique on userId alone).
 */
export async function ensureReviewIndexes(): Promise<void> {
  const database = mongoose.connection.db;
  if (!database) return;

  try {
    const reviewIndexes = await database.collection("reviews").indexes();
    for (const idx of reviewIndexes) {
      if (idx.name === "_id_") continue;

      if (idx.unique) {
        const keys = Object.keys(idx.key);
        const isCorrectCompoundUnique =
          keys.length === 3 &&
          idx.key.targetType === 1 &&
          idx.key.targetId === 1 &&
          idx.key.userId === 1;

        if (!isCorrectCompoundUnique && idx.name) {
          console.warn(
            `[ensureReviewIndexes] Dropping stale unique index on 'reviews': "${idx.name}" (${JSON.stringify(idx.key)})`
          );
          await database.collection("reviews").dropIndex(idx.name);
        }
      }
    }
  } catch (err: any) {
    console.warn("[ensureReviewIndexes] Could not inspect reviews indexes:", err?.message);
  }

  try {
    await Review.createIndexes();
    await RatingSummary.createIndexes();
  } catch (err: any) {
    console.warn("[ensureReviewIndexes] Could not create indexes:", err?.message);
  }
}

// ============= Errors =============

/**
 * Anything the caller got wrong. `status` maps straight onto the HTTP
 * response so the route layer stays a thin translation.
 */
export class ReviewError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "ReviewError";
    this.status = status;
  }
}

const isDuplicateKey = (error: unknown): boolean =>
  (error as { code?: number })?.code === 11000;

// ============= Founder check =============

/**
 * Same rule as `routes/feed.ts:isUserFounder` — the legacy single-org role
 * plus the multi-org membership array, with stakeholder `fullAccess` counting
 * as founder access.
 */
export async function isUserFounder(
  userId: string | Types.ObjectId,
  orgId: string | Types.ObjectId
): Promise<boolean> {
  const user = await User.findById(userId)
    .select("role organization organizations")
    .lean();

  if (!user) return false;

  const orgIdStr = orgId.toString();

  if (
    user.organization?.toString() === orgIdStr &&
    ["admin", "founder"].includes(user.role || "")
  ) {
    return true;
  }

  if (user.organizations) {
    const membership = (user.organizations as any[]).find(
      (m: any) => m.organization?.toString() === orgIdStr
    );
    if (membership && hasFounderAccess(membership)) return true;
  }

  return false;
}

// ============= Target resolution + access gates =============

export interface TargetAccess {
  /** Does this user have access to the thing at all? */
  allowed: boolean;
  /** True when access traces to a payment rather than a free / auto join. */
  isVerifiedPurchase: boolean;
}

interface TargetHandler {
  /** Human label used in error messages. */
  label: string;
  /**
   * The target's own collection. Used by the moderation queue to look up
   * display names in one query per type — a founder reviewing their org's
   * feedback needs to see WHAT each review is about, not a bare ObjectId.
   */
  model: mongoose.Model<any>;
  /** Owning org of the target, or null if the target doesn't exist. */
  resolveOrg(targetId: Types.ObjectId): Promise<Types.ObjectId | null>;
  /** Does this non-founder user have access, and did they pay for it? */
  checkAccess(
    userId: Types.ObjectId,
    targetId: Types.ObjectId
  ): Promise<TargetAccess>;
}

const DENIED: TargetAccess = { allowed: false, isVerifiedPurchase: false };
const ALLOWED_PAID: TargetAccess = { allowed: true, isVerifiedPurchase: true };

/**
 * One entry per reviewable thing. To make a new feature reviewable: add its
 * type to REVIEW_TARGET_TYPES and a handler here. Nothing else in the system
 * changes — routes, summaries and moderation are all target-agnostic.
 */
const TARGET_HANDLERS: Record<ReviewTargetType, TargetHandler> = {
  channel: {
    label: "community",
    model: Channel,
    async resolveOrg(targetId) {
      const channel = await Channel.findById(targetId).select("storeId").lean();
      return (channel?.storeId as Types.ObjectId) ?? null;
    },
    async checkAccess(userId, targetId) {
      // Membership is the gate, not payment: free communities and the
      // auto-joined default community are legitimate memberships.
      // See services/channel.ts:autoJoinDefaultChannel.
      const [membership, channel] = await Promise.all([
        ChannelMembership.findOne({
          userId,
          channelId: targetId,
          status: "active",
        })
          .select("lastPaymentDate subscriptionId")
          .lean(),
        Channel.findById(targetId).select("isFree price").lean(),
      ]);

      if (!membership) return DENIED;

      const paidMembership = Boolean(
        (membership as any).lastPaymentDate || (membership as any).subscriptionId
      );
      const paidChannel = Boolean(
        channel && channel.isFree === false && (channel.price ?? 0) > 0
      );

      return {
        allowed: true,
        isVerifiedPurchase: paidMembership || paidChannel,
      };
    },
  },

  course: {
    label: "course",
    model: Course,
    async resolveOrg(targetId) {
      const course = await Course.findById(targetId)
        .select("organizationId")
        .lean();
      return (course?.organizationId as Types.ObjectId) ?? null;
    },
    async checkAccess(userId, targetId) {
      const enrollment = await CourseEnrollment.findOne({
        courseId: targetId,
        userId,
        status: { $in: ["enrolled", "completed"] },
      })
        .select("_id")
        .lean();
      return enrollment ? ALLOWED_PAID : DENIED;
    },
  },

  product: {
    label: "product",
    model: Product,
    async resolveOrg(targetId) {
      const product = await Product.findById(targetId)
        .select("organizationId")
        .lean();
      return (product?.organizationId as Types.ObjectId) ?? null;
    },
    async checkAccess(userId, targetId) {
      // A product review requires an actual purchase.
      //
      // `paymentStatus: "paid"` is the signal, NOT `status` — an order can sit
      // at status "confirmed" while payment is still pending (COD), and the
      // fulfilment statuses (shipped/delivered) don't apply to digital
      // products at all. Refunded orders are excluded by the same check, and
      // cancelled ones are ruled out explicitly.
      //
      // Products live in the `items` array, so the match is on
      // `items.productId` — this mirrors the existing index
      // { userId, "items.productId", paymentStatus }.
      const order = await ProductOrder.findOne({
        userId,
        "items.productId": targetId,
        paymentStatus: "paid",
        status: { $nin: ["cancelled", "refunded"] },
      })
        .select("_id")
        .lean();
      return order ? ALLOWED_PAID : DENIED;
    },
  },

  workshop: {
    label: "workshop",
    model: Workshop,
    async resolveOrg(targetId) {
      const workshop = await Workshop.findById(targetId).select("orgId").lean();
      return (workshop?.orgId as Types.ObjectId) ?? null;
    },
    async checkAccess(userId, targetId) {
      const registration = await WorkshopRegistration.findOne({
        workshopId: targetId,
        userId,
        status: { $in: ["registered", "attended"] },
      })
        .select("_id")
        .lean();
      return registration ? ALLOWED_PAID : DENIED;
    },
  },

  service: {
    label: "service",
    model: Service,
    async resolveOrg(targetId) {
      const service = await Service.findById(targetId)
        .select("organizationId")
        .lean();
      return (service?.organizationId as Types.ObjectId) ?? null;
    },
    async checkAccess(userId, targetId) {
      // Matches the pre-existing ServiceReview rule: completed opt-ins only.
      const opt = await ServiceOpt.findOne({
        serviceId: targetId,
        userId,
        status: "completed",
      })
        .select("_id")
        .lean();
      return opt ? ALLOWED_PAID : DENIED;
    },
  },

  call: {
    label: "call",
    model: CallOffering,
    async resolveOrg(targetId) {
      const call = await CallOffering.findById(targetId)
        .select("organizationId")
        .lean();
      return (call?.organizationId as Types.ObjectId) ?? null;
    },
    async checkAccess(userId, targetId) {
      const purchase = await CallPurchase.findOne({
        callOfferingId: targetId,
        userId,
      })
        .select("_id")
        .lean();
      return purchase ? ALLOWED_PAID : DENIED;
    },
  },

  office: {
    label: "office",
    model: Organization as unknown as mongoose.Model<any>,
    // The office IS the org, so the target id is its own owning org. Resolving
    // through a findById rather than trusting the id means a review can't be
    // filed against an org that doesn't exist.
    async resolveOrg(targetId) {
      const org = await Organization.findById(targetId).select("_id").lean();
      return ((org as any)?._id as Types.ObjectId) ?? null;
    },
    // Having joined the office is the gate. There is nothing to buy, so an
    // office review is never a "verified purchase" — the badge would be
    // meaningless here.
    async checkAccess(userId, targetId) {
      const member = await User.findOne({
        _id: userId,
        $or: [
          { "organizations.organization": targetId },
          // Legacy single-org users predate the memberships array.
          { organization: targetId },
        ],
      })
        .select("_id")
        .lean();

      return member ? { allowed: true, isVerifiedPurchase: false } : DENIED;
    },
  },
};

export function isReviewTargetType(value: string): value is ReviewTargetType {
  return Object.prototype.hasOwnProperty.call(TARGET_HANDLERS, value);
}

/**
 * The org that owns a target, or null if the target doesn't exist.
 *
 * Callers that need to know "is this viewer a founder of the thing being
 * reviewed?" must resolve the org from the target — a RatingSummaryPayload
 * deliberately carries no org, since it is served to unauthenticated guests.
 */
export async function resolveTargetOrg(
  targetType: ReviewTargetType,
  targetId: string
): Promise<Types.ObjectId | null> {
  const handler = TARGET_HANDLERS[targetType];
  if (!handler) {
    throw new ReviewError(`Unsupported review target: ${targetType}`, 400);
  }
  return handler.resolveOrg(requireObjectId(targetId, "target id"));
}

function requireObjectId(value: string, label: string): Types.ObjectId {
  if (!Types.ObjectId.isValid(value)) {
    throw new ReviewError(`Invalid ${label}`, 400);
  }
  return new Types.ObjectId(value);
}

export interface ReviewEligibility {
  organizationId: Types.ObjectId;
  isVerifiedPurchase: boolean;
  isOwnerReview: boolean;
}

/**
 * Resolve the owning org and decide whether this user may review the target.
 *
 * Throws ReviewError(404) if the target doesn't exist, ReviewError(403) if the
 * user has no access to it.
 */
export async function assertCanReview(
  userId: string,
  targetType: ReviewTargetType,
  targetId: string
): Promise<ReviewEligibility> {
  const handler = TARGET_HANDLERS[targetType];
  if (!handler) {
    throw new ReviewError(`Unsupported review target: ${targetType}`, 400);
  }

  const targetObjectId = requireObjectId(targetId, "target id");
  const userObjectId = requireObjectId(userId, "user id");

  const organizationId = await handler.resolveOrg(targetObjectId);
  if (!organizationId) {
    throw new ReviewError(`That ${handler.label} does not exist`, 404);
  }

  if (await isUserFounder(userId, organizationId)) {
    if (!ownerMayReview(targetType)) {
      throw new ReviewError(
        `You can't review an ${handler.label} you run`,
        403
      );
    }
    return { organizationId, isVerifiedPurchase: false, isOwnerReview: true };
  }

  const access = await handler.checkAccess(userObjectId, targetObjectId);
  if (!access.allowed) {
    throw new ReviewError(
      `You need access to this ${handler.label} before you can review it`,
      403
    );
  }

  return {
    organizationId,
    isVerifiedPurchase: access.isVerifiedPurchase,
    isOwnerReview: false,
  };
}

export type ReviewIneligibleReason =
  | "ok"
  | "target_missing"
  | "no_access"
  | "owner";

export interface ReviewEligibilityResult {
  /** Should the UI offer a write-a-review entry point? */
  canReview: boolean;
  /** Does the user have access to the target at all (member/enrolled/bought)? */
  hasAccess: boolean;
  /** True when the viewer is a founder of the org that owns the target. */
  isOwner: boolean;
  isVerifiedPurchase: boolean;
  reason: ReviewIneligibleReason;
}

/**
 * Non-throwing counterpart to `assertCanReview`, for deciding whether to SHOW
 * the write-a-review button.
 *
 * This has to be answered server-side: whether a given viewer may review a
 * given community depends on their membership in THAT community, which the
 * client cannot determine from an org-level role. A viewer browsing Discover
 * sees communities they have not joined, and must not be offered the form for
 * them.
 *
 * Founders get `canReview: false` — they own the thing, so no write entry
 * point — while still being reported as `isOwner` so the caller can explain
 * why rather than silently hiding the control.
 */
export async function getReviewEligibility(
  userId: string,
  targetType: ReviewTargetType,
  targetId: string
): Promise<ReviewEligibilityResult> {
  const handler = TARGET_HANDLERS[targetType];
  if (!handler) {
    throw new ReviewError(`Unsupported review target: ${targetType}`, 400);
  }

  const targetObjectId = requireObjectId(targetId, "target id");
  const userObjectId = requireObjectId(userId, "user id");

  const organizationId = await handler.resolveOrg(targetObjectId);
  if (!organizationId) {
    return {
      canReview: false,
      hasAccess: false,
      isOwner: false,
      isVerifiedPurchase: false,
      reason: "target_missing",
    };
  }

  if (await isUserFounder(userId, organizationId)) {
    return {
      canReview: false,
      hasAccess: true,
      isOwner: true,
      isVerifiedPurchase: false,
      reason: "owner",
    };
  }

  const access = await handler.checkAccess(userObjectId, targetObjectId);

  return {
    canReview: access.allowed,
    hasAccess: access.allowed,
    isOwner: false,
    isVerifiedPurchase: access.isVerifiedPurchase,
    reason: access.allowed ? "ok" : "no_access",
  };
}

// ============= Summary recomputation =============

const STAR_FIELDS = ["star1", "star2", "star3", "star4", "star5"] as const;

/**
 * Rebuild the denormalized aggregate for one target from the Review
 * collection, in full.
 *
 * Always called inside the same transaction as the review write that triggered
 * it. Two concurrent writes to the same target both update this one summary
 * document, so the second transaction hits a write conflict and is retried by
 * `withTransaction` — which is what serializes them. A full rebuild (rather
 * than an increment) also means a stale or corrupted row self-heals on the
 * next write, and that `scripts/backfill-rating-summaries.ts` can repair any
 * row without knowing its history.
 */
export async function recomputeRatingSummary(
  targetType: ReviewTargetType,
  targetId: Types.ObjectId | string,
  organizationId: Types.ObjectId | string,
  session?: ClientSession
): Promise<void> {
  const targetObjectId = new Types.ObjectId(targetId.toString());

  const match: Record<string, unknown> = {
    targetType,
    targetId: targetObjectId,
    status: "published",
  };

  const aggregation = Review.aggregate<{
    _id: { rating: number; isOwnerReview: boolean };
    count: number;
    verified: number;
    lastAt: Date;
  }>([
    { $match: match },
    {
      $group: {
        _id: { rating: "$rating", isOwnerReview: "$isOwnerReview" },
        count: { $sum: 1 },
        verified: { $sum: { $cond: ["$isVerifiedPurchase", 1, 0] } },
        lastAt: { $max: "$createdAt" },
      },
    },
  ]);
  if (session) aggregation.session(session);
  const rows = await aggregation;

  const distribution: IStarCounts = { ...EMPTY_STAR_COUNTS };
  let count = 0;
  let verifiedCount = 0;
  let ownerReviewCount = 0;
  let weighted = 0;
  let lastReviewAt: Date | undefined;

  for (const row of rows) {
    const { rating, isOwnerReview } = row._id;

    if (row.lastAt && (!lastReviewAt || row.lastAt > lastReviewAt)) {
      lastReviewAt = row.lastAt;
    }

    if (isOwnerReview) {
      ownerReviewCount += row.count;
      if (REVIEW_AVERAGE_EXCLUDES_OWNER) continue;
    }

    const field = STAR_FIELDS[rating - 1];
    if (!field) continue; // defensive: schema already bounds rating to 1-5

    distribution[field] += row.count;
    count += row.count;
    verifiedCount += row.verified;
    weighted += rating * row.count;
  }

  // Rounded to 2dp on write so the card and the detail page can never disagree
  // about rounding.
  const average = count > 0 ? Math.round((weighted / count) * 100) / 100 : 0;

  const update = {
    $set: {
      organizationId: new Types.ObjectId(organizationId.toString()),
      average,
      count,
      distribution,
      verifiedCount,
      ownerReviewCount,
      lastReviewAt: lastReviewAt ?? null,
    },
  };

  try {
    const existingSummary = await RatingSummary.findOne({
      targetType,
      targetId: targetObjectId,
    }).session(session || null);

    if (existingSummary) {
      await RatingSummary.updateOne(
        { _id: existingSummary._id },
        update,
        { session }
      );
    } else {
      try {
        await RatingSummary.create(
          [
            {
              targetType,
              targetId: targetObjectId,
              ...update.$set,
            },
          ],
          session ? { session } : undefined
        );
      } catch (error) {
        if (!isDuplicateKey(error)) throw error;
        await RatingSummary.updateOne(
          { targetType, targetId: targetObjectId },
          update,
          { session }
        );
      }
    }
  } catch (err) {
    console.error(`[recomputeRatingSummary] Failed for ${targetType}:${targetObjectId}:`, err);
    throw err;
  }
}

// ============= Summary read payloads =============

export type StarKey = 1 | 2 | 3 | 4 | 5;

export interface RatingSummaryPayload {
  targetType: ReviewTargetType;
  targetId: string;
  /** Mean rating, 2dp. 0 when there are no reviews. */
  average: number;
  /** Reviews behind `average`. */
  count: number;
  /** Raw count per star, keyed 1-5. */
  distribution: Record<StarKey, number>;
  /** Share per star, 0-100, 1dp. Sums to ~100 (±0.1 from rounding). */
  distributionPercent: Record<StarKey, number>;
  /** Reviews from paying members/purchasers. Subset of `count`. */
  verifiedCount: number;
  /** Founder self-reviews, excluded from `average`/`count` by default. */
  ownerReviewCount: number;
  lastReviewAt: Date | null;
}

interface StoredSummary {
  average?: number;
  count?: number;
  distribution?: Partial<IStarCounts>;
  verifiedCount?: number;
  ownerReviewCount?: number;
  lastReviewAt?: Date | null;
}

/**
 * Shape a stored summary — or a missing one — into the API payload. Targets
 * with no reviews yet return a fully-zeroed payload so callers can map 1:1
 * over a list without null checks.
 */
export function toSummaryPayload(
  targetType: ReviewTargetType,
  targetId: string,
  summary: StoredSummary | null
): RatingSummaryPayload {
  const stars: IStarCounts = {
    ...EMPTY_STAR_COUNTS,
    ...(summary?.distribution || {}),
  };
  const count = summary?.count ?? 0;

  const pct = (n: number) =>
    count > 0 ? Math.round((n / count) * 1000) / 10 : 0;

  const distribution = {
    1: stars.star1,
    2: stars.star2,
    3: stars.star3,
    4: stars.star4,
    5: stars.star5,
  } as Record<StarKey, number>;

  return {
    targetType,
    targetId,
    average: summary?.average ?? 0,
    count,
    distribution,
    distributionPercent: {
      1: pct(distribution[1]),
      2: pct(distribution[2]),
      3: pct(distribution[3]),
      4: pct(distribution[4]),
      5: pct(distribution[5]),
    } as Record<StarKey, number>,
    verifiedCount: summary?.verifiedCount ?? 0,
    ownerReviewCount: summary?.ownerReviewCount ?? 0,
    lastReviewAt: summary?.lastReviewAt ?? null,
  };
}

export async function getRatingSummary(
  targetType: ReviewTargetType,
  targetId: string
): Promise<RatingSummaryPayload> {
  const targetObjectId = requireObjectId(targetId, "target id");
  const summary = await RatingSummary.findOne({
    targetType,
    targetId: targetObjectId,
  }).lean();

  return toSummaryPayload(targetType, targetId, summary as StoredSummary);
}

/**
 * Batched summary read for grid views — the Discover community cards fetch
 * every rating in one round trip instead of one query per card.
 *
 * Invalid ids are skipped rather than throwing, so one bad id in a list of 60
 * doesn't blank the whole grid; they come back as zeroed payloads like any
 * other target with no reviews.
 */
export async function getRatingSummaries(
  targetType: ReviewTargetType,
  targetIds: string[]
): Promise<Record<string, RatingSummaryPayload>> {
  if (targetIds.length > MAX_SUMMARY_BATCH) {
    throw new ReviewError(
      `Too many ids — request at most ${MAX_SUMMARY_BATCH} at a time`,
      400
    );
  }

  const unique = [...new Set(targetIds)];
  const valid = unique.filter((id) => Types.ObjectId.isValid(id));

  const summaries = valid.length
    ? await RatingSummary.find({
        targetType,
        targetId: { $in: valid.map((id) => new Types.ObjectId(id)) },
      }).lean()
    : [];

  const byId = new Map(summaries.map((s: any) => [s.targetId.toString(), s]));

  const out: Record<string, RatingSummaryPayload> = {};
  for (const id of unique) {
    out[id] = toSummaryPayload(targetType, id, byId.get(id) || null);
  }
  return out;
}

// ============= Write helpers =============

/**
 * Run `fn` in a transaction. `withTransaction` retries automatically on
 * transient errors and write conflicts — which is exactly what serializes two
 * concurrent reviews of the same target, since both contend on the one
 * RatingSummary document.
 */
async function inTransaction<T>(
  fn: (session: ClientSession) => Promise<T>
): Promise<T> {
  const session = await mongoose.startSession();
  try {
    let result: T;
    await session.withTransaction(async () => {
      result = await fn(session);
    });
    return result!;
  } finally {
    await session.endSession();
  }
}

/**
 * Only accept image URLs we could have produced. Reviews render their
 * attachments in an <img>, so an arbitrary caller-supplied string here would
 * be an open redirect / tracking-pixel vector.
 */
function normalizeImages(images: string[]): string[] {
  if (images.length > MAX_REVIEW_IMAGES) {
    throw new ReviewError(
      `You can attach at most ${MAX_REVIEW_IMAGES} images`,
      400
    );
  }

  return images.map((raw) => {
    const url = raw.trim();
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new ReviewError(`"${url}" is not a valid image URL`, 400);
    }
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      throw new ReviewError("Image URLs must be http(s)", 400);
    }
    return url;
  });
}

/** Normalize and validate the user-authored parts of a review. */
function normalizeContent(input: {
  body?: string;
  title?: string;
  images?: string[];
}): {
  body?: string;
  title?: string;
  images?: string[];
} {
  const out: { body?: string; title?: string; images?: string[] } = {};

  if (input.body !== undefined) {
    const body = toPlainText(input.body);
    if (!body) {
      throw new ReviewError("Review text can't be empty", 400);
    }
    // Measured after normalization, and on visible characters only — see
    // countReviewChars in review.model.ts.
    if (countReviewChars(body) > MAX_REVIEW_BODY) {
      throw new ReviewError(
        `Review must be ${MAX_REVIEW_BODY} characters or fewer (spaces not counted)`,
        400
      );
    }
    out.body = body;
  }

  if (input.title !== undefined) {
    // An explicit empty title clears it rather than failing.
    out.title = toPlainSingleLine(input.title) || undefined;
  }

  if (input.images !== undefined) {
    out.images = normalizeImages(input.images);
  }

  return out;
}

function assertValidRating(rating: number): void {
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new ReviewError("Rating must be a whole number from 1 to 5", 400);
  }
}

// ============= Review CRUD =============

export interface CreateReviewInput {
  userId: string;
  targetType: ReviewTargetType;
  targetId: string;
  rating: number;
  body: string;
  title?: string;
  images?: string[];
}

export async function createReview(input: CreateReviewInput): Promise<IReview> {
  const { userId, targetType, targetId, rating } = input;

  assertValidRating(rating);
  const content = normalizeContent(input);

  // Access + org resolution happen before the transaction: they're reads
  // against unrelated collections and keep the transaction window short.
  const eligibility = await assertCanReview(userId, targetType, targetId);

  const user = await User.findById(userId)
    .select("name email department profilePicture")
    .lean();
  if (!user) throw new ReviewError("User not found", 404);

  const targetObjectId = new Types.ObjectId(targetId);
  const userObjectId = new Types.ObjectId(userId);

  // Submitting when you already have a review here is an edit, not an error —
  // the one-review-per-target rule is kept by updating the existing row. The
  // duplicate-key path below only remains for the create/create race, where a
  // second attempt finds the winner's row and edits it.
  const attempt = () =>
    inTransaction(async (session) => {
      const mine = await Review.findOne({
        targetType,
        targetId: targetObjectId,
        userId: userObjectId,
      }).session(session);

      let review: IReview;
      if (mine) {
        mine.rating = rating;
        if (content.body !== undefined) mine.body = content.body;
        mine.title = content.title;
        mine.images = content.images || [];
        mine.reviewerName = user.name || user.email || mine.reviewerName;
        mine.reviewerRole = user.department ?? undefined;
        mine.reviewerAvatar = user.profilePicture ?? undefined;
        mine.isVerifiedPurchase = eligibility.isVerifiedPurchase;
        mine.isOwnerReview = eligibility.isOwnerReview;
        mine.editedAt = new Date();
        await mine.save({ session });
        review = mine;
      } else {
        const created = await Review.create(
          [
            {
              targetType,
              targetId: targetObjectId,
              organizationId: eligibility.organizationId,
              userId: userObjectId,
              rating,
              title: content.title,
              body: content.body,
              images: content.images || [],
              reviewerName: user.name || user.email || "Member",
              reviewerRole: user.department,
              reviewerAvatar: user.profilePicture,
              isVerifiedPurchase: eligibility.isVerifiedPurchase,
              isOwnerReview: eligibility.isOwnerReview,
              status: "published",
            },
          ],
          { session }
        );
        review = created[0];
      }

      await recomputeRatingSummary(
        targetType,
        targetObjectId,
        eligibility.organizationId,
        session
      );

      return review;
    });

  try {
    return await attempt();
  } catch (error) {
    // A duplicate-key here means two creates raced: this transaction lost and
    // aborted, but the row now exists — rerunning takes the edit path above.
    if (!isDuplicateKey(error)) throw error;
    try {
      return await attempt();
    } catch (retryError) {
      if (isDuplicateKey(retryError)) {
        // Before returning 409, check if the user actually has an existing review in DB
        const existing = await Review.findOne({
          targetType,
          targetId: targetObjectId,
          userId: userObjectId,
        }).lean();

        if (existing) {
          try {
            return await updateReview((existing as any)._id.toString(), userId, {
              rating,
              body: content.body,
              title: content.title,
              images: content.images,
            });
          } catch {
            throw new ReviewError(
              "You've already reviewed this — edit your existing review instead",
              409
            );
          }
        }

        console.error(
          `[createReview] Duplicate key error occurred but no review exists for user ${userId} on ${targetType}:${targetId}. Error:`,
          retryError
        );
        throw new ReviewError(
          "Failed to submit review due to a database index conflict. Please contact support.",
          500
        );
      }
      throw retryError;
    }
  }
}

export interface UpdateReviewInput {
  rating?: number;
  body?: string;
  title?: string;
  images?: string[];
}

/**
 * Edit your own review. Founders can hide or delete a review on their content
 * but never rewrite its words — see `moderateReview` / `deleteReview`.
 */
export async function updateReview(
  reviewId: string,
  userId: string,
  input: UpdateReviewInput
): Promise<IReview> {
  const reviewObjectId = requireObjectId(reviewId, "review id");
  const userObjectId = requireObjectId(userId, "user id");

  if (input.rating !== undefined) assertValidRating(input.rating);
  const content = normalizeContent(input);

  if (
    input.rating === undefined &&
    content.body === undefined &&
    input.title === undefined &&
    input.images === undefined
  ) {
    throw new ReviewError("Nothing to update", 400);
  }

  return inTransaction(async (session) => {
    const review = await Review.findOne({
      _id: reviewObjectId,
      userId: userObjectId,
    }).session(session);

    if (!review) throw new ReviewError("Review not found", 404);

    // Catches a review written before the owner was barred from this target
    // type — the create path now rejects it, so editing must too, or the old
    // row stays quietly maintainable.
    if (
      !ownerMayReview(review.targetType) &&
      (await isUserFounder(userId, review.organizationId))
    ) {
      throw new ReviewError(
        `You can't review an ${TARGET_HANDLERS[review.targetType]?.label ?? "item"} you run`,
        403
      );
    }

    if (input.rating !== undefined) review.rating = input.rating;
    if (content.body !== undefined) review.body = content.body;
    if (input.title !== undefined) review.title = content.title;
    if (content.images !== undefined) review.images = content.images;
    review.editedAt = new Date();

    // Refresh the denormalized reviewer snapshot so an edited review doesn't
    // keep showing a name or avatar the user has since changed.
    const user = await User.findById(userObjectId)
      .select("name email department profilePicture")
      .lean();
    if (user) {
      review.reviewerName = user.name || user.email || review.reviewerName;
      review.reviewerRole = user.department ?? undefined;
      review.reviewerAvatar = user.profilePicture ?? undefined;
    }

    await review.save({ session });

    await recomputeRatingSummary(
      review.targetType,
      review.targetId,
      review.organizationId,
      session
    );

    return review;
  });
}

/**
 * Delete a review. The author can always delete their own; a founder of the
 * owning org can delete any review on their own content.
 *
 * Returns false when the review doesn't exist, so a repeated delete is a
 * no-op rather than an error.
 */
export async function deleteReview(
  reviewId: string,
  userId: string
): Promise<boolean> {
  const reviewObjectId = requireObjectId(reviewId, "review id");

  const existing = await Review.findById(reviewObjectId)
    .select("userId organizationId")
    .lean();
  if (!existing) return false;

  const isAuthor = (existing as any).userId.toString() === userId;
  if (!isAuthor) {
    const founder = await isUserFounder(
      userId,
      (existing as any).organizationId
    );
    if (!founder) {
      throw new ReviewError("You can only delete your own review", 403);
    }
  }

  return inTransaction(async (session) => {
    const review = await Review.findById(reviewObjectId).session(session);
    if (!review) return false;

    await Review.deleteOne({ _id: review._id }, { session });
    await ReviewVote.deleteMany({ reviewId: review._id }, { session });

    await recomputeRatingSummary(
      review.targetType,
      review.targetId,
      review.organizationId,
      session
    );

    return true;
  });
}

/**
 * Take down a review's written content — the comment text and every attached
 * screenshot — while leaving the star rating standing.
 *
 * This is the founder's moderation tool, and it is deliberately narrower than
 * deleting the review. Someone who rated an office 2 stars still rated it 2
 * stars; removing what they wrote must not quietly improve the average, so the
 * rating, the reviewer and the review's place in the summary are all untouched.
 * What goes is the part a founder might legitimately need gone: abusive text,
 * a screenshot leaking someone's data.
 *
 * Still not a rewrite. A founder can remove words, never change them.
 *
 * No summary recompute: an average is a function of ratings and statuses, and
 * neither moves here.
 */
export async function removeReviewComment(
  reviewId: string,
  userId: string
): Promise<IReview> {
  const reviewObjectId = requireObjectId(reviewId, "review id");
  const userObjectId = requireObjectId(userId, "user id");

  const review = await Review.findById(reviewObjectId);
  if (!review) throw new ReviewError("Review not found", 404);

  const isAuthor = review.userId.toString() === userId;
  if (!isAuthor) {
    const founder = await isUserFounder(userId, review.organizationId);
    if (!founder) {
      throw new ReviewError(
        "Only the author or a founder can remove a review's comment",
        403
      );
    }
  }

  // Already stripped — most likely a double-click, or two founders acting at
  // once. Report the current state rather than failing the second caller.
  if (review.commentRemovedAt && !review.body && review.images.length === 0) {
    return review;
  }

  review.body = "";
  review.images = [];
  review.commentRemovedAt = new Date();
  review.commentRemovedBy = userObjectId;

  if (!isAuthor) {
    // `status` is deliberately left alone: taking down a comment is not a
    // visibility decision, and stamping one here would make the review look
    // hidden or re-published when it wasn't.
    review.moderatedBy = userObjectId;
    review.moderatedAt = new Date();
    review.moderationNote = "Comment and attachments removed";
  }

  await review.save();
  return review;
}

// ============= Listing =============

export type ReviewSort = "recent" | "helpful" | "highest" | "lowest";

export interface ListReviewsOptions {
  page?: number;
  limit?: number;
  sort?: ReviewSort;
  /** Filter to a single star value. */
  rating?: number;
  /** Only reviews from paying members/purchasers. */
  verifiedOnly?: boolean;
  /** Include hidden/pending reviews. Founder-only — the route enforces it. */
  includeHidden?: boolean;
  /** When set, annotates each review with `isMine` / `viewerHasMarkedHelpful`. */
  viewerId?: string;
}

const SORT_MAP: Record<ReviewSort, Record<string, 1 | -1>> = {
  // `_id` breaks ties so pagination is stable when many reviews share a
  // timestamp or helpful count — without it, a row can appear on two pages.
  recent: { createdAt: -1, _id: -1 },
  helpful: { helpfulCount: -1, createdAt: -1, _id: -1 },
  highest: { rating: -1, createdAt: -1, _id: -1 },
  lowest: { rating: 1, createdAt: -1, _id: -1 },
};

export const MAX_PAGE_SIZE = 100;

export async function listReviews(
  targetType: ReviewTargetType,
  targetId: string,
  options: ListReviewsOptions = {}
): Promise<{
  reviews: any[];
  total: number;
  page: number;
  totalPages: number;
  summary: RatingSummaryPayload;
}> {
  const targetObjectId = requireObjectId(targetId, "target id");

  const page = Math.max(1, Math.floor(options.page || 1));
  const limit = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, Math.floor(options.limit || 20))
  );
  const sort = SORT_MAP[options.sort || "recent"] || SORT_MAP.recent;

  const filter: Record<string, unknown> = {
    targetType,
    targetId: targetObjectId,
  };
  if (!options.includeHidden) filter.status = "published";
  if (options.rating) {
    assertValidRating(options.rating);
    filter.rating = options.rating;
  }
  if (options.verifiedOnly) filter.isVerifiedPurchase = true;

  const [total, reviews, summary] = await Promise.all([
    Review.countDocuments(filter),
    Review.find(filter)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    getRatingSummary(targetType, targetId),
  ]);

  // The viewer's own votes for this page, in one extra query rather than one
  // per review — this is what lights up the Helpful / Unhelpful buttons.
  const viewerVotes = new Map<string, ReviewVoteValue>();
  if (options.viewerId && reviews.length) {
    const votes = await ReviewVote.find({
      userId: new Types.ObjectId(options.viewerId),
      reviewId: { $in: reviews.map((r: any) => r._id) },
    })
      .select("reviewId vote")
      .lean();
    for (const v of votes as any[]) {
      viewerVotes.set(v.reviewId.toString(), v.vote);
    }
  }

  return {
    reviews: reviews.map((r: any) => ({
      ...r,
      isMine: options.viewerId ? r.userId.toString() === options.viewerId : false,
      /** "helpful" | "unhelpful" | null — which button is active for me. */
      viewerVote: viewerVotes.get(r._id.toString()) ?? null,
    })),
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    summary,
  };
}

/** The signed-in user's own review of a target, if any. Powers "edit yours". */
export async function getMyReview(
  userId: string,
  targetType: ReviewTargetType,
  targetId: string
): Promise<IReview | null> {
  const targetObjectId = requireObjectId(targetId, "target id");
  const userObjectId = requireObjectId(userId, "user id");

  return Review.findOne({
    targetType,
    targetId: targetObjectId,
    userId: userObjectId,
  }).lean() as any;
}

// ============= Helpful / Unhelpful votes =============

export interface ReviewVoteResult {
  helpfulCount: number;
  notHelpfulCount: number;
  /** The viewer's vote after this call — null when cleared. */
  viewerVote: ReviewVoteValue | null;
}

const COUNTER_FIELD: Record<ReviewVoteValue, "helpfulCount" | "notHelpfulCount"> =
  {
    helpful: "helpfulCount",
    unhelpful: "notHelpfulCount",
  };

/**
 * Set, switch, or clear the caller's vote on a review.
 *
 * `vote: null` clears it — which is what tapping the already-active button
 * does in the UI. Every path is idempotent: voting "helpful" twice leaves the
 * counter at one, and clearing a vote that was never cast is a no-op.
 *
 * The counters move by an O(1) delta derived from the vote row's *previous*
 * value (returned by findOneAndUpdate/Delete), so switching helpful →
 * unhelpful is a single round trip rather than a full recount. The delta is
 * applied with a floor of 0 so the counters can't go negative if the two
 * collections ever diverge; `recountReviewVotes()` repairs them from source.
 */
export async function voteOnReview(
  reviewId: string,
  userId: string,
  vote: ReviewVoteValue | null
): Promise<ReviewVoteResult> {
  const reviewObjectId = requireObjectId(reviewId, "review id");
  const userObjectId = requireObjectId(userId, "user id");

  const review = await Review.findById(reviewObjectId)
    .select("helpfulCount notHelpfulCount")
    .lean();
  if (!review) throw new ReviewError("Review not found", 404);

  let previous: ReviewVoteValue | null = null;

  if (vote === null) {
    const removed = await ReviewVote.findOneAndDelete(
      { reviewId: reviewObjectId, userId: userObjectId },
      { projection: { vote: 1 } }
    ).lean();
    previous = ((removed as any)?.vote as ReviewVoteValue) ?? null;
  } else {
    try {
      const prior = await ReviewVote.findOneAndUpdate(
        { reviewId: reviewObjectId, userId: userObjectId },
        { $set: { vote } },
        {
          upsert: true,
          returnDocument: "before",
          projection: { vote: 1 },
        }
      ).lean();
      previous = ((prior as any)?.vote as ReviewVoteValue) ?? null;
    } catch (error) {
      // Two votes raced to create the row. The row now exists, so a plain
      // update settles it; treat the prior value as unknown-but-present by
      // recounting below.
      if (!isDuplicateKey(error)) throw error;
      await ReviewVote.updateOne(
        { reviewId: reviewObjectId, userId: userObjectId },
        { $set: { vote } }
      );
      const counts = await recountReviewVotes(reviewObjectId);
      return { ...counts, viewerVote: vote };
    }
  }

  // Nothing changed — same vote re-submitted, or a clear with nothing to clear.
  if (previous === vote) {
    return {
      helpfulCount: (review as any).helpfulCount || 0,
      notHelpfulCount: (review as any).notHelpfulCount || 0,
      viewerVote: vote,
    };
  }

  const inc: Record<string, number> = {};
  if (previous) inc[COUNTER_FIELD[previous]] = -1;
  if (vote) inc[COUNTER_FIELD[vote]] = (inc[COUNTER_FIELD[vote]] || 0) + 1;

  const updated = await Review.findByIdAndUpdate(
    reviewObjectId,
    [
      {
        $set: {
          helpfulCount: {
            $max: [
              0,
              {
                $add: [
                  { $ifNull: ["$helpfulCount", 0] },
                  inc.helpfulCount || 0,
                ],
              },
            ],
          },
          notHelpfulCount: {
            $max: [
              0,
              {
                $add: [
                  { $ifNull: ["$notHelpfulCount", 0] },
                  inc.notHelpfulCount || 0,
                ],
              },
            ],
          },
        },
      },
    ],
    { new: true, select: "helpfulCount notHelpfulCount" }
  ).lean();

  return {
    helpfulCount: (updated as any)?.helpfulCount || 0,
    notHelpfulCount: (updated as any)?.notHelpfulCount || 0,
    viewerVote: vote,
  };
}

/**
 * Rebuild a review's vote counters from the ReviewVote rows. Used to settle a
 * race in `voteOnReview` and available to the backfill script for repair.
 */
export async function recountReviewVotes(
  reviewId: Types.ObjectId | string
): Promise<{ helpfulCount: number; notHelpfulCount: number }> {
  const reviewObjectId = new Types.ObjectId(reviewId.toString());

  const rows = await ReviewVote.aggregate<{ _id: ReviewVoteValue; n: number }>([
    { $match: { reviewId: reviewObjectId } },
    { $group: { _id: "$vote", n: { $sum: 1 } } },
  ]);

  const helpfulCount = rows.find((r) => r._id === "helpful")?.n || 0;
  const notHelpfulCount = rows.find((r) => r._id === "unhelpful")?.n || 0;

  await Review.updateOne(
    { _id: reviewObjectId },
    { $set: { helpfulCount, notHelpfulCount } }
  );

  return { helpfulCount, notHelpfulCount };
}

// ============= Moderation (founder) =============

export async function moderateReview(
  reviewId: string,
  founderId: string,
  status: ReviewStatus,
  note?: string
): Promise<IReview> {
  const reviewObjectId = requireObjectId(reviewId, "review id");
  const founderObjectId = requireObjectId(founderId, "user id");

  const existing = await Review.findById(reviewObjectId)
    .select("organizationId")
    .lean();
  if (!existing) throw new ReviewError("Review not found", 404);

  const founder = await isUserFounder(
    founderId,
    (existing as any).organizationId
  );
  if (!founder) {
    throw new ReviewError("Only founders can moderate reviews", 403);
  }

  return inTransaction(async (session) => {
    const review = await Review.findById(reviewObjectId).session(session);
    if (!review) throw new ReviewError("Review not found", 404);

    review.status = status;
    review.moderatedBy = founderObjectId;
    review.moderatedAt = new Date();
    if (note !== undefined) {
      review.moderationNote = toPlainSingleLine(note) || undefined;
    }

    await review.save({ session });

    await recomputeRatingSummary(
      review.targetType,
      review.targetId,
      review.organizationId,
      session
    );

    return review;
  });
}

/**
 * Display names for a page of reviews, as `targetType:targetId -> name`.
 *
 * One query per target type present on the page rather than one per review, so
 * a 100-row moderation page costs at most seven lookups. Models disagree on
 * whether the human label lives in `name` or `title`, so both are selected and
 * whichever is set wins; a target deleted since its review was written simply
 * has no entry and the caller falls back to the type label.
 */
async function resolveTargetNames(
  reviews: Array<{ targetType: ReviewTargetType; targetId: Types.ObjectId }>
): Promise<Map<string, string>> {
  const idsByType = new Map<ReviewTargetType, Set<string>>();
  for (const review of reviews) {
    const bucket = idsByType.get(review.targetType) ?? new Set<string>();
    bucket.add(review.targetId.toString());
    idsByType.set(review.targetType, bucket);
  }

  const names = new Map<string, string>();

  await Promise.all(
    [...idsByType.entries()].map(async ([targetType, ids]) => {
      const handler = TARGET_HANDLERS[targetType];
      if (!handler) return;

      try {
        const docs = await handler.model
          .find({ _id: { $in: [...ids].map((id) => new Types.ObjectId(id)) } })
          .select("name title")
          .lean();

        for (const doc of docs as any[]) {
          const label = doc.name || doc.title;
          if (label) names.set(`${targetType}:${doc._id.toString()}`, label);
        }
      } catch (error) {
        // A lookup failure must not blank the whole queue — the rows just
        // render with their type label instead of a name.
        console.error(`[reviews] name lookup failed for ${targetType}:`, error);
      }
    })
  );

  return names;
}

/**
 * Org-wide moderation queue — every review across every product type the org
 * owns, newest first. Founder-only; the route enforces that.
 *
 * Rows carry `targetName` / `targetLabel` so the founder sees which community,
 * course or product each review is attached to without a second round trip.
 */
export async function listOrgReviews(
  organizationId: string,
  options: {
    status?: ReviewStatus;
    targetType?: ReviewTargetType;
    page?: number;
    limit?: number;
  } = {}
): Promise<{ reviews: any[]; total: number; page: number; totalPages: number }> {
  const orgObjectId = requireObjectId(organizationId, "org id");

  const page = Math.max(1, Math.floor(options.page || 1));
  const limit = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, Math.floor(options.limit || 20))
  );

  const filter: Record<string, unknown> = { organizationId: orgObjectId };
  if (options.status) filter.status = options.status;
  if (options.targetType) filter.targetType = options.targetType;

  const [total, reviews] = await Promise.all([
    Review.countDocuments(filter),
    Review.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
  ]);

  const names = await resolveTargetNames(reviews as any[]);

  return {
    reviews: (reviews as any[]).map((review) => ({
      ...review,
      targetName:
        names.get(`${review.targetType}:${review.targetId.toString()}`) ?? null,
      targetLabel: TARGET_HANDLERS[review.targetType as ReviewTargetType]?.label,
    })),
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}
