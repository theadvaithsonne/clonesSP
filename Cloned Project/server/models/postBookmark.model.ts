import { Schema, model, Types } from "mongoose";

export interface IPostBookmark {
  _id: Types.ObjectId;
  postId: Types.ObjectId;
  userId: Types.ObjectId;
  orgId: Types.ObjectId;
  createdAt: Date;
}

const PostBookmarkSchema = new Schema(
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

// Unique index to prevent duplicate bookmarks
PostBookmarkSchema.index({ postId: 1, userId: 1 }, { unique: true });

// Index for getting user's bookmarks (most common query)
PostBookmarkSchema.index({ userId: 1, orgId: 1, createdAt: -1 });

// Activity feed: who saved a set of posts, newest first — the inverse of the
// index above, which answers "what did this user save".
PostBookmarkSchema.index({ postId: 1, createdAt: -1 });

export const PostBookmark = model<IPostBookmark>(
  "PostBookmark",
  PostBookmarkSchema
);
