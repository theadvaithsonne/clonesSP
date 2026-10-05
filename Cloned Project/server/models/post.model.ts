import { Schema, model, Types } from "mongoose";

// Reactions count interface
export interface IReactionsCount {
  like: number;
  love: number;
  haha: number;
  wow: number;
  sad: number;
  angry: number;
  // Added 2026-06-20 alongside comment-react surface. Optional in the
  // interface so older Post docs that haven't been backfilled still
  // typecheck — readers should treat missing values as 0.
  fire?: number;
  money?: number;
  total: number;
}

export interface IPost {
  _id: Types.ObjectId;
  content: string;
  authorId: Types.ObjectId;
  orgId: Types.ObjectId;
  channelIds: Types.ObjectId[];
  tags: string[];
  mentions: Types.ObjectId[]; // Users mentioned in the post
  attachments: {
    type: "image" | "video" | "document" | "audio";
    url: string;
    name: string;
    fileKey?: string;
  }[];
  // Link preview metadata stored with post
  linkPreviews: {
    url: string;
    title?: string;
    description?: string;
    image?: string;
    siteName?: string;
    showThumbnail?: boolean;
  }[];
  likesCount: number; // Deprecated - kept for backward compatibility
  reactionsCount: IReactionsCount;
  commentsCount: number;
  repostsCount: number;
  // Quote post - references another post
  quotedPostId?: Types.ObjectId;
  // Poll reference
  hasPoll: boolean;
  // Article fields
  postType: "post" | "article";
  title?: string;
  coverImage?: string;
  slug?: string;
  readingTimeMinutes?: number;
  isPinned: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const PostSchema = new Schema(
  {
    content: { type: String, required: true },
    authorId: {
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
    channelIds: [
      {
        type: Schema.Types.ObjectId,
        ref: "Channel",
        required: true,
      },
    ],
    tags: [{ type: String, trim: true, maxlength: 50 }],
    mentions: [{ type: Schema.Types.ObjectId, ref: "User" }],
    attachments: [
      {
        type: {
          type: String,
          enum: ["image", "video", "document", "audio"],
          required: true,
        },
        url: { type: String, required: true },
        name: { type: String, required: true },
        fileKey: { type: String },
      },
    ],
    // Link preview metadata stored with post
    // Default to undefined so we can distinguish between "not set" (old posts) and "empty" (user removed previews)
    linkPreviews: {
      type: [
        {
          url: { type: String, required: true },
          title: { type: String },
          description: { type: String },
          image: { type: String },
          siteName: { type: String },
          showThumbnail: { type: Boolean, default: true },
        },
      ],
      default: undefined,
    },
    likesCount: { type: Number, default: 0, min: 0 }, // Deprecated - kept for backward compatibility
    reactionsCount: {
      like: { type: Number, default: 0, min: 0 },
      love: { type: Number, default: 0, min: 0 },
      haha: { type: Number, default: 0, min: 0 },
      wow: { type: Number, default: 0, min: 0 },
      sad: { type: Number, default: 0, min: 0 },
      angry: { type: Number, default: 0, min: 0 },
      fire: { type: Number, default: 0, min: 0 },
      money: { type: Number, default: 0, min: 0 },
      total: { type: Number, default: 0, min: 0 },
    },
    commentsCount: { type: Number, default: 0, min: 0 },
    repostsCount: { type: Number, default: 0, min: 0 },
    // Quote post - references another post
    quotedPostId: {
      type: Schema.Types.ObjectId,
      ref: "Post",
      default: null,
    },
    // Poll reference
    hasPoll: { type: Boolean, default: false },
    // Article fields
    postType: {
      type: String,
      enum: ["post", "article"],
      default: "post",
    },
    title: { type: String, maxlength: 200 },
    coverImage: { type: String },
    slug: { type: String },
    readingTimeMinutes: { type: Number, min: 0 },
    isPinned: { type: Boolean, default: false, index: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Indexes for efficient queries
PostSchema.index({ orgId: 1, createdAt: -1 });
PostSchema.index({ channelIds: 1, createdAt: -1 });
PostSchema.index({ authorId: 1, createdAt: -1 });
PostSchema.index({ tags: 1 });
PostSchema.index({ orgId: 1, channelIds: 1, createdAt: -1 });
// Sparse index for fast pinned-post lookups per org (only indexes docs where isPinned exists)
PostSchema.index({ orgId: 1, isPinned: 1 }, { sparse: true });
// Slug lookup for articles (sparse: only indexes docs where slug exists)
PostSchema.index({ orgId: 1, slug: 1 }, { unique: true, sparse: true });
// Activity feed: "posts that mention me", newest first. `mentions` is an array,
// so this is a multikey index — one entry per mentioned user per post.
PostSchema.index({ mentions: 1, createdAt: -1 });

export const Post = model<IPost>("Post", PostSchema);
