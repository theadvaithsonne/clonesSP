// src/models/standaloneVideo.model.ts
import mongoose, { Schema, Document, Types } from "mongoose";

export interface IStandaloneVideo extends Document {
  _id: Types.ObjectId;
  title: string;
  description?: string;
  thumbnail?: string;
  videoUrl?: string; // External link (YouTube, Vimeo, direct URL)
  videoS3Key?: string; // Uploaded video S3 key
  sourceType: "upload" | "link";
  duration?: number; // Duration in seconds
  orgId: Types.ObjectId;
  createdBy: Types.ObjectId;
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const StandaloneVideoSchema = new Schema<IStandaloneVideo>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 5000,
    },
    thumbnail: {
      type: String,
      trim: true,
    },
    videoUrl: {
      type: String,
      trim: true,
    },
    videoS3Key: {
      type: String,
      trim: true,
    },
    sourceType: {
      type: String,
      enum: ["upload", "link"],
      required: true,
      default: "upload",
    },
    duration: {
      type: Number,
      default: 0,
    },
    orgId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    isPublished: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// Indexes for efficient queries
StandaloneVideoSchema.index({ orgId: 1, isPublished: 1, createdAt: -1 });
StandaloneVideoSchema.index({ createdBy: 1, createdAt: -1 });

export const StandaloneVideo = mongoose.model<IStandaloneVideo>(
  "StandaloneVideo",
  StandaloneVideoSchema
);
