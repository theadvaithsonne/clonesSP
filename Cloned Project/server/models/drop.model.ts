// src/models/drop.model.ts
// Short-form video "Drops" (Reels/Shorts-style content) — max 60 seconds.
// Any org member can upload. Cursor-based pagination for infinite scroll.

import mongoose, { Schema, Document, Types } from "mongoose";

export interface IDrop extends Document {
  _id: Types.ObjectId;
  caption: string;
  authorId: Types.ObjectId;
  orgId: Types.ObjectId;

  // Video source — exactly one of these should be set
  videoUrl?: string;        // External link (YouTube, Vimeo, direct MP4)
  videoS3Key?: string;      // Uploaded video S3 key
  sourceType: "upload" | "link";

  // Metadata
  thumbnailUrl?: string;    // Poster image URL
  duration: number;         // Duration in seconds (max 60)

  // Engagement counters (denormalized for fast reads)
  viewsCount: number;
  likesCount: number;
  sharesCount: number;

  // Who liked this. Backs the idempotent like toggle — `likesCount` alone
  // couldn't tell a repeat like from a new one, so a refresh (which wiped
  // the client's in-memory liked state) let the same user count twice.
  likedBy: Types.ObjectId[];

  // Status
  isPublished: boolean;
  isActive: boolean;

  createdAt: Date;
  updatedAt: Date;
}

const DropSchema = new Schema<IDrop>(
  {
    caption: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },
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

    // Video source
    videoUrl: { type: String, trim: true },
    videoS3Key: { type: String, trim: true },
    sourceType: {
      type: String,
      enum: ["upload", "link"],
      required: true,
      default: "upload",
    },

    // Metadata
    thumbnailUrl: { type: String, trim: true },
    duration: { type: Number, default: 0, min: 0, max: 60 },

    // Engagement
    viewsCount: { type: Number, default: 0, min: 0 },
    likesCount: { type: Number, default: 0, min: 0 },
    sharesCount: { type: Number, default: 0, min: 0 },

    // `select: false` — this list is only ever queried for membership,
    // never shipped to clients (it would grow the feed payload and leak
    // who liked what).
    likedBy: {
      type: [{ type: Schema.Types.ObjectId, ref: "User" }],
      default: [],
      select: false,
    },

    // Status
    isPublished: { type: Boolean, default: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// ─── Indexes ───────────────────────────────────────────────────────
// Primary feed query: cursor-based pagination sorted by newest first.
// The compound index on (orgId, isActive, isPublished, createdAt, _id)
// ensures the cursor seek is always O(log n), not O(n) like offset/skip.
DropSchema.index(
  { orgId: 1, isActive: 1, isPublished: 1, createdAt: -1, _id: -1 },
  { name: "feed_cursor_idx" }
);

// User's own drops
DropSchema.index({ authorId: 1, createdAt: -1 });

// Trending sort
DropSchema.index({ orgId: 1, viewsCount: -1 });

// Multikey index for "which of these drops did I like?" — the feed runs
// this once per page, and the like toggle uses it as an existence guard.
DropSchema.index({ likedBy: 1 });

export const Drop = mongoose.model<IDrop>("Drop", DropSchema);
