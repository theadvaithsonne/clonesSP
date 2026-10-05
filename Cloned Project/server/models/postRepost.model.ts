import { Schema, model, Types } from "mongoose";

export interface IPostRepost {
  _id: Types.ObjectId;
  postId: Types.ObjectId;
  userId: Types.ObjectId;
  orgId: Types.ObjectId;
  createdAt: Date;
}

const PostRepostSchema = new Schema(
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
  },
  { timestamps: true }
);

// Unique index to prevent duplicate reposts
PostRepostSchema.index({ postId: 1, userId: 1 }, { unique: true });

// Index for getting user's reposts
PostRepostSchema.index({ userId: 1, createdAt: -1 });

// Index for getting reposts of a post
PostRepostSchema.index({ postId: 1, createdAt: -1 });

export const PostRepost = model<IPostRepost>("PostRepost", PostRepostSchema);
