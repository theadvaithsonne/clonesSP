import mongoose, { Schema, Document, Types } from "mongoose";
import { REVIEW_TARGET_TYPES, ReviewTargetType } from "./review.model";

/**
 * Denormalized rating aggregate — one row per (targetType, targetId).
 *
 * Exists so the Discover grid can render a star + count on every community
 * card from a single batched read, instead of a $group over the Review
 * collection per card. Recomputed in full by `recomputeRatingSummary()` inside
 * the same transaction as every review write, so it can never drift from the
 * underlying reviews. Because the recompute is a full rebuild rather than an
 * increment, `scripts/backfill-rating-summaries.ts` can repair any row at any
 * time without knowing its history.
 *
 * Stars are stored as `star1`..`star5` rather than numeric keys `1`..`5`.
 * Mongo update paths like `distribution.1` are ambiguous with array-index
 * access; named fields keep every update path unambiguous. The API layer maps
 * these back to `1`..`5` for the client (`toSummaryPayload`).
 */

export interface IStarCounts {
  star1: number;
  star2: number;
  star3: number;
  star4: number;
  star5: number;
}

export interface IRatingSummary extends Document {
  _id: Types.ObjectId;

  targetType: ReviewTargetType;
  targetId: Types.ObjectId;
  organizationId: Types.ObjectId;

  /** Mean of the counted reviews, 2dp. 0 when count is 0. */
  average: number;
  /** Number of reviews behind `average`. */
  count: number;
  distribution: IStarCounts;

  /** Subset of `count` whose access traced to a payment. */
  verifiedCount: number;

  /**
   * Reviews written by a founder of the owning org. Excluded from `average`
   * and `count` (see REVIEW_AVERAGE_EXCLUDES_OWNER) but tracked so the
   * exclusion is visible rather than silent.
   *
   * Always 0 for target types a founder may not review at all — see
   * `OWNER_CANNOT_REVIEW` in services/review.ts.
   */
  ownerReviewCount: number;

  lastReviewAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}

const StarCountsSchema = new Schema<IStarCounts>(
  {
    star1: { type: Number, default: 0, min: 0 },
    star2: { type: Number, default: 0, min: 0 },
    star3: { type: Number, default: 0, min: 0 },
    star4: { type: Number, default: 0, min: 0 },
    star5: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

export const EMPTY_STAR_COUNTS: IStarCounts = {
  star1: 0,
  star2: 0,
  star3: 0,
  star4: 0,
  star5: 0,
};

const RatingSummarySchema = new Schema<IRatingSummary>(
  {
    targetType: {
      type: String,
      enum: REVIEW_TARGET_TYPES,
      required: true,
    },
    targetId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },

    average: { type: Number, default: 0, min: 0, max: 5 },
    count: { type: Number, default: 0, min: 0 },
    distribution: {
      type: StarCountsSchema,
      default: () => ({ ...EMPTY_STAR_COUNTS }),
    },
    verifiedCount: { type: Number, default: 0, min: 0 },
    ownerReviewCount: { type: Number, default: 0, min: 0 },

    lastReviewAt: { type: Date },
  },
  { timestamps: true }
);

// One summary per target. Also the lookup key for the batched Discover read,
// and the document whose write-conflict serializes concurrent recomputes.
RatingSummarySchema.index({ targetType: 1, targetId: 1 }, { unique: true });

// "Top rated communities in this org."
RatingSummarySchema.index({ organizationId: 1, targetType: 1, average: -1 });

export const RatingSummary = mongoose.model<IRatingSummary>(
  "RatingSummary",
  RatingSummarySchema
);
