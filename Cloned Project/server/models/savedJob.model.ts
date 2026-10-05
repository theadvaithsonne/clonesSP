// src/models/savedJob.model.ts
//
// A job posting a member bookmarked from Garage Jobs (Discover → Save).
// One row per (member, posting); saving twice is a no-op.

import { Schema, model, Document, Types } from "mongoose";

export interface ISavedJob extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  jobId: Types.ObjectId;
  createdAt: Date;
}

const SavedJobSchema = new Schema<ISavedJob>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    jobId: { type: Schema.Types.ObjectId, ref: "JobPosting", required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

SavedJobSchema.index({ userId: 1, jobId: 1 }, { unique: true });
SavedJobSchema.index({ userId: 1, createdAt: -1 });

export const SavedJob = model<ISavedJob>("SavedJob", SavedJobSchema);
