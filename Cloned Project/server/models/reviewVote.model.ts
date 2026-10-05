import mongoose, { Schema, Document, Types } from "mongoose";

/**
 * One row per (review, user) who voted on a review's usefulness.
 *
 * The UI offers "Helpful" and "Unhelpful" as a toggle pair, so a vote is
 * tri-state: helpful, unhelpful, or absent (the row is deleted). Kept in its
 * own collection rather than as arrays on Review so:
 *
 *  - a replayed request can't inflate a counter (the unique index is the
 *    idempotency guard), and
 *  - "how did I vote on these 20 reviews?" is one indexed query, not 20.
 *
 * `Review.helpfulCount` / `Review.notHelpfulCount` are denormalized tallies of
 * these rows; `recountReviewVotes()` rebuilds them from here if they drift.
 */

export const REVIEW_VOTE_VALUES = ["helpful", "unhelpful"] as const;
export type ReviewVoteValue = (typeof REVIEW_VOTE_VALUES)[number];

export interface IReviewVote extends Document {
  _id: Types.ObjectId;
  reviewId: Types.ObjectId;
  userId: Types.ObjectId;
  vote: ReviewVoteValue;
  createdAt: Date;
  updatedAt: Date;
}

const ReviewVoteSchema = new Schema<IReviewVote>(
  {
    reviewId: {
      type: Schema.Types.ObjectId,
      ref: "Review",
      required: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    vote: {
      type: String,
      enum: REVIEW_VOTE_VALUES,
      required: true,
    },
  },
  { timestamps: true }
);

// One vote per user per review. Switching from helpful to unhelpful updates
// this row rather than adding a second one.
ReviewVoteSchema.index({ reviewId: 1, userId: 1 }, { unique: true });

// "How did I vote on this page of reviews?"
ReviewVoteSchema.index({ userId: 1, reviewId: 1 });

// Powers the recount aggregation.
ReviewVoteSchema.index({ reviewId: 1, vote: 1 });

export const ReviewVote = mongoose.model<IReviewVote>(
  "ReviewVote",
  ReviewVoteSchema
);
