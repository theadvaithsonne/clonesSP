import { Schema, model, Types } from "mongoose";
import type { IReactionsCount } from "./post.model";

export interface ICommentAttachment {
  // Widened to match the route Zod schema + addComment service signature
  // (which both already accept video + document). The old image|gif|audio
  // enum was silently rejecting saves on those types.
  type: "image" | "video" | "document" | "audio" | "gif";
  url: string;
  name: string;
  fileKey?: string;
}

export interface IPostComment {
  _id: Types.ObjectId;
  postId: Types.ObjectId;
  userId: Types.ObjectId;
  orgId: Types.ObjectId;
  content: string;
  mentions: Types.ObjectId[]; // Users mentioned in the comment
  attachments?: ICommentAttachment[]; // Comment attachments
  parentCommentId?: Types.ObjectId; // For nested replies
  // Denormalized reaction counters — same shape as Post.reactionsCount.
  // Mobile + Garage web both read `reactionsCount` straight off the
  // comment so the UI updates without a separate count query.
  reactionsCount?: IReactionsCount;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CommentAttachmentSchema = new Schema(
  {
    type: {
      type: String,
      enum: ["image", "video", "document", "audio", "gif"],
      required: true,
    },
    url: { type: String, required: true },
    name: { type: String, required: true },
    fileKey: { type: String },
  },
  { _id: false }
);

const PostCommentSchema = new Schema(
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
    content: { type: String, maxlength: 2000, default: "" },
    mentions: [{ type: Schema.Types.ObjectId, ref: "User" }],
    attachments: [CommentAttachmentSchema],
    parentCommentId: {
      type: Schema.Types.ObjectId,
      ref: "PostComment",
      default: null,
    },
    reactionsCount: {
      like:  { type: Number, default: 0 },
      love:  { type: Number, default: 0 },
      haha:  { type: Number, default: 0 },
      wow:   { type: Number, default: 0 },
      sad:   { type: Number, default: 0 },
      angry: { type: Number, default: 0 },
      fire:  { type: Number, default: 0 },
      money: { type: Number, default: 0 },
      total: { type: Number, default: 0 },
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Indexes for efficient queries
PostCommentSchema.index({ postId: 1, createdAt: 1 });
PostCommentSchema.index({ postId: 1, parentCommentId: 1 });
PostCommentSchema.index({ userId: 1, createdAt: -1 });

// Feed activity — the `reply` stream's sorted `$in` on parentCommentId. The
// existing { postId, parentCommentId } cannot serve it: parentCommentId is not
// its prefix, so without this the query is a collection scan plus a blocking
// in-memory sort — the same 32MB failure the scan limits in
// services/feedActivity.ts exist to avoid.
PostCommentSchema.index({ parentCommentId: 1, createdAt: -1 });

// Feed activity — the `comment_mention` stream. Multikey on `mentions`. There
// was no index on this field at all, so every Activity load AND every unread
// badge poll scanned the whole comment collection.
PostCommentSchema.index({ mentions: 1, orgId: 1, createdAt: -1 });

export const PostComment = model<IPostComment>("PostComment", PostCommentSchema);
