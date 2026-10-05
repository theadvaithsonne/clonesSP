import { Schema, model, Types } from "mongoose";

// Reaction types constant. `fire` and `money` were added 2026-06-20
// alongside the comment-react surface (mobile + Garage web both fire
// these). Mongoose enum below uses the same array so newly-published
// reactions don't get silently rejected on save.
export const REACTION_TYPES = [
  'like',
  'love',
  'haha',
  'wow',
  'sad',
  'angry',
  'fire',
  'money',
] as const;
export type ReactionType = typeof REACTION_TYPES[number];

export interface IPostLike {
  _id: Types.ObjectId;
  postId: Types.ObjectId;
  userId: Types.ObjectId;
  orgId: Types.ObjectId;
  reactionType: ReactionType;
  createdAt: Date;
  updatedAt: Date;
}

const PostLikeSchema = new Schema(
  {
    postId: {
      type: Schema.Types.ObjectId,
      ref: "Post",
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
      default: 'like',
      required: true,
    },
  },
  { timestamps: true }
);

// Unique index to prevent duplicate reactions per user per post
PostLikeSchema.index({ postId: 1, userId: 1 }, { unique: true });

// Index for counting reactions per post
PostLikeSchema.index({ postId: 1 });

// Index for counting reactions by type per post
PostLikeSchema.index({ postId: 1, reactionType: 1 });

// Activity feed: reactions across a set of posts, newest first. The
// { postId: 1 } index above cannot serve that sort, so without this the planner
// falls back to a blocking in-memory sort as soon as the postId list grows.
// NOTE: { postId: 1 } is a prefix of this one and is now redundant. Left in
// place deliberately — dropping a live index is an ops call, not a code one.
PostLikeSchema.index({ postId: 1, createdAt: -1 });

export const PostLike = model<IPostLike>("PostLike", PostLikeSchema);
