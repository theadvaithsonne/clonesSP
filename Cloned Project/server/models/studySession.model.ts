// src/models/studySession.model.ts
import mongoose, { Schema, Document, Types } from "mongoose";

export interface IStudySession extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  organizationId: Types.ObjectId;
  courseId: Types.ObjectId;
  chapterId?: Types.ObjectId;
  sectionId?: Types.ObjectId;

  startedAt: Date;
  endedAt?: Date;
  duration: number; // Total seconds spent
  lastHeartbeat: Date; // Last heartbeat timestamp

  // Denormalized for quick reads
  courseTitle: string;
  chapterTitle?: string;

  createdAt: Date;
  updatedAt: Date;
}

const StudySessionSchema = new Schema<IStudySession>(
  {
    userId: { type: Schema.Types.ObjectId, required: true, index: true },
    organizationId: { type: Schema.Types.ObjectId, required: true, index: true },
    courseId: { type: Schema.Types.ObjectId, required: true, ref: "Course" },
    chapterId: { type: Schema.Types.ObjectId },
    sectionId: { type: Schema.Types.ObjectId },

    startedAt: { type: Date, required: true, default: Date.now },
    endedAt: { type: Date },
    duration: { type: Number, default: 0 },
    lastHeartbeat: { type: Date, required: true, default: Date.now },

    courseTitle: { type: String, default: "" },
    chapterTitle: { type: String, default: "" },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for efficient querying
StudySessionSchema.index({ userId: 1, startedAt: -1 });
StudySessionSchema.index({ userId: 1, organizationId: 1, startedAt: -1 });
// Index for finding active sessions (endedAt: null) — most-queried pattern
StudySessionSchema.index({ userId: 1, organizationId: 1, endedAt: 1 });

export const StudySession = mongoose.model<IStudySession>("StudySession", StudySessionSchema);
