import { Schema, model, Types } from "mongoose";
import { REACTION_TYPES, type ReactionType } from "./postLike.model";

/**
 * Per-user reaction on a single PostComment. Mirrors PostLike but keyed
 * on (commentId, userId) — unique index enforces one reaction per user
 * per comment, with `reactionType` swapped in place when the user picks
 * a different emoji. The denormalized counts live on
 * PostComment.reactionsCount so the comment feed can render counts
 * without a separate aggregation pass.
 *
 * REACTION_TYPES is shared with the post surface so adding `fire` /
 * `money` (2026-06-20) covered both at once.
 */
export interface IPostCommentLike {
  _id: Types.ObjectId;
  commentId: Types.ObjectId;
  userId: Types.ObjectId;
  orgId: Types.ObjectId;
  reactionType: ReactionType;
  createdAt: Date;
  updatedAt: Date;
}

const PostCommentLikeSchema = new Schema(
  {
    commentId: {
      type: Schema.Types.ObjectId,
      ref: "PostComment",
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    orgId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    reactionType: {
      type: String,
      enum: REACTION_TYPES,
      default: "like",
      required: true,
    },
  },
  { timestamps: true }
);

// One reaction per user per comment.
PostCommentLikeSchema.index({ commentId: 1, userId: 1 }, { unique: true });

// Feed activity — the `comment_like` stream's sorted `$in` on commentId. The
// plain { commentId } index gives membership but no ordering, so the sort was
// buffered in memory; this lets the planner serve it by explode-for-sort.
PostCommentLikeSchema.index({ commentId: 1, createdAt: -1 });
// Useful for the per-reaction-type listing (matches the post surface).
PostCommentLikeSchema.index({ commentId: 1, reactionType: 1 });

export const PostCommentLike = model<IPostCommentLike>(
  "PostCommentLike",
  PostCommentLikeSchema,
);
