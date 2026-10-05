import mongoose, { Schema, Document, Types } from "mongoose";

/**
 * Polymorphic review.
 *
 * Replaces the per-feature copy-paste (`Channel.reviews[]`, `Course.reviews[]`,
 * `Product.reviews[]`, `Workshop.reviews[]`, `ServiceReview`) with one
 * collection keyed by (targetType, targetId). Adding ratings to a new feature
 * means adding a target type + an access gate in `services/review.ts` — no new
 * model, no new routes.
 *
 * The founder-authored `rating` / `ratingCount` / `reviews[]` fields still on
 * the Channel/Course/Product/Workshop documents are NOT touched by this system.
 * They stay as a manual override the founder can set; `RatingSummary` is the
 * source of truth for real user-submitted ratings.
 */

export const REVIEW_TARGET_TYPES = [
  "channel", // a community
  "course",
  "product",
  "workshop",
  "service",
  "call",
  "office", // the organization itself — rated by the people who joined it
] as const;

export type ReviewTargetType = (typeof REVIEW_TARGET_TYPES)[number];

export const REVIEW_STATUSES = ["published", "pending", "hidden"] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

/** Screenshots per review, matching the upload box in the write-review modal. */
export const MAX_REVIEW_IMAGES = 6;

/**
 * Length caps for the two user-authored fields. Exported so the route
 * validators and the model schema can't drift apart — the frontend mirrors
 * these in WriteReviewDialog.tsx.
 */
export const MAX_REVIEW_TITLE = 140;
export const MAX_REVIEW_BODY = 500;

/**
 * Length of a review body for limit purposes: whitespace does NOT count.
 *
 * Counting only visible characters means the cap measures how much someone
 * actually wrote, and padding a review with spaces or blank lines can't be
 * used to burn through the allowance. The stored string keeps its whitespace —
 * this is purely how the limit is measured, and the frontend counter uses the
 * same rule so it never promises room the API will reject.
 */
export function countReviewChars(value: string): number {
  return value.replace(/\s/g, "").length;
}

export interface IReview extends Document {
  _id: Types.ObjectId;

  // What is being reviewed
  targetType: ReviewTargetType;
  targetId: Types.ObjectId;
  organizationId: Types.ObjectId;

  // Who wrote it
  userId: Types.ObjectId;

  // Content
  rating: number; // 1-5, whole stars
  /** "Review headline" in the write-a-review modal. */
  title?: string;
  body: string;
  /**
   * Optional screenshots. Stored as URLs already uploaded through the
   * existing upload route — this collection never holds binary data.
   */
  images: string[];

  // Reviewer snapshot — denormalized so listing reviews never needs a $lookup
  // into User. Refreshed on edit.
  reviewerName: string;
  reviewerRole?: string;
  reviewerAvatar?: string;

  // Signal, not a gate. True when the reviewer's access traces to a payment
  // rather than a free join / auto-join / founder bypass. Lets the UI badge
  // "Verified purchase" and lets us weight or filter later without a migration.
  isVerifiedPurchase: boolean;

  // Set when the review was written by a founder of the owning org — i.e. by
  // someone reviewing their own product. Founders are allowed to review (they
  // bypass the membership gate), so this exists to keep the case visible.
  isOwnerReview: boolean;

  /**
   * Denormalized vote tallies. The authoritative per-user rows live in
   * ReviewVote; these are the counters the list endpoint renders.
   */
  helpfulCount: number;
  notHelpfulCount: number;

  status: ReviewStatus;
  moderatedBy?: Types.ObjectId;
  moderatedAt?: Date;
  moderationNote?: string;

  /**
   * Set when the comment text and attachments were taken down while the rating
   * was kept — see `removeReviewComment`. Distinguishes a moderated review from
   * one that simply never had a body, so the UI can say "comment removed"
   * rather than rendering a confusing blank.
   */
  commentRemovedAt?: Date;
  commentRemovedBy?: Types.ObjectId;

  editedAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}

const ReviewSchema = new Schema<IReview>(
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
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
      validate: {
        validator: Number.isInteger,
        message: "Rating must be a whole number between 1 and 5",
      },
    },
    title: { type: String, trim: true, maxlength: MAX_REVIEW_TITLE },
    body: {
      type: String,
      // Not `required`, because a moderated review legitimately has no body:
      // `removeReviewComment` clears the text and keeps the rating. Non-empty
      // is still enforced on the write paths that accept user input — the
      // route's zod schema and `normalizeContent` — so this can only be empty
      // by way of a take-down.
      default: "",
      trim: true,
      // Not `maxlength` — the cap counts non-whitespace characters only, so
      // the stored string may legitimately be longer than MAX_REVIEW_BODY.
      validate: {
        validator: (v: string) => countReviewChars(v) <= MAX_REVIEW_BODY,
        message: `A review can be at most ${MAX_REVIEW_BODY} characters (spaces not counted)`,
      },
    },
    images: {
      type: [String],
      default: [],
      validate: {
        validator: (v: string[]) => v.length <= MAX_REVIEW_IMAGES,
        message: `A review can have at most ${MAX_REVIEW_IMAGES} images`,
      },
    },

    reviewerName: { type: String, required: true, trim: true },
    reviewerRole: { type: String, trim: true },
    reviewerAvatar: { type: String, trim: true },

    isVerifiedPurchase: { type: Boolean, default: false },
    isOwnerReview: { type: Boolean, default: false },

    helpfulCount: { type: Number, default: 0, min: 0 },
    notHelpfulCount: { type: Number, default: 0, min: 0 },

    status: {
      type: String,
      enum: REVIEW_STATUSES,
      default: "published",
    },
    moderatedBy: { type: Schema.Types.ObjectId, ref: "User" },
    moderatedAt: { type: Date },
    moderationNote: { type: String, trim: true },

    commentRemovedAt: { type: Date },
    commentRemovedBy: { type: Schema.Types.ObjectId, ref: "User" },

    editedAt: { type: Date },
  },
  { timestamps: true }
);

// One review per user per target.
ReviewSchema.index(
  { targetType: 1, targetId: 1, userId: 1 },
  { unique: true }
);

// Listing: newest first (default sort).
ReviewSchema.index({ targetType: 1, targetId: 1, status: 1, createdAt: -1 });

// Listing: most helpful first.
ReviewSchema.index({ targetType: 1, targetId: 1, status: 1, helpfulCount: -1 });

// Listing filtered by star value ("show me the 1-star reviews").
ReviewSchema.index({ targetType: 1, targetId: 1, status: 1, rating: 1 });

// Founder moderation queue across the whole org.
ReviewSchema.index({ organizationId: 1, status: 1, createdAt: -1 });

// "My reviews" / cleanup when a user is removed.
ReviewSchema.index({ userId: 1, createdAt: -1 });

export const Review = mongoose.model<IReview>("Review", ReviewSchema);
