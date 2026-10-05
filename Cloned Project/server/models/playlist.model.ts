// src/models/playlist.model.ts
import mongoose, { Schema, Document, Types } from "mongoose";

// Structured video entry — tracks source type for each video in the playlist
export interface IVideoEntry {
  videoSource: "workshop" | "standalone" | "courseVideo";
  videoId: Types.ObjectId; // Workshop._id or StandaloneVideo._id (or chapterId for courseVideo)
  courseId?: Types.ObjectId; // Only for courseVideo
  sectionId?: Types.ObjectId; // Only for courseVideo
  chapterId?: Types.ObjectId; // Only for courseVideo
}

export interface IPlaylist extends Document {
  _id: Types.ObjectId;
  title: string;
  description?: string;
  coverImage?: string;
  organizationId: Types.ObjectId;
  createdBy: Types.ObjectId;
  type: "founder" | "learner";
  isPublished: boolean;
  videoEntries: IVideoEntry[];
  // Legacy field — kept for backward compatibility, will be auto-migrated on read
  videoIds: Types.ObjectId[];
  videoCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const VideoEntrySchema = new Schema<IVideoEntry>(
  {
    videoSource: {
      type: String,
      enum: ["workshop", "standalone", "courseVideo"],
      required: true,
    },
    videoId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    courseId: {
      type: Schema.Types.ObjectId,
    },
    sectionId: {
      type: Schema.Types.ObjectId,
    },
    chapterId: {
      type: Schema.Types.ObjectId,
    },
  },
  { _id: false }
);

const PlaylistSchema = new Schema<IPlaylist>(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, trim: true, maxlength: 2000 },
    coverImage: { type: String, trim: true },
    organizationId: {
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
    type: {
      type: String,
      enum: ["founder", "learner"],
      required: true,
      default: "learner",
    },
    isPublished: { type: Boolean, default: false },
    videoEntries: {
      type: [VideoEntrySchema],
      default: [],
    },
    // Legacy field — kept for backward compatibility
    videoIds: [
      {
        type: Schema.Types.ObjectId,
        // No ref — legacy field, auto-migrated on read
      },
    ],
    videoCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// Indexes for efficient queries
PlaylistSchema.index({ organizationId: 1, type: 1, isPublished: 1 });
PlaylistSchema.index({ createdBy: 1, type: 1 });

// Pre-save hook: keep videoCount in sync (prefer videoEntries, fallback to videoIds)
PlaylistSchema.pre("save", function (next) {
  this.videoCount =
    this.videoEntries && this.videoEntries.length > 0
      ? this.videoEntries.length
      : this.videoIds.length;
  next();
});

export const Playlist = mongoose.model<IPlaylist>("Playlist", PlaylistSchema);
