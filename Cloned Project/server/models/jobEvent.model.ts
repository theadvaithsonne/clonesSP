// src/models/jobEvent.model.ts
//
// Raw view / apply-start events for a posting — the time series behind the
// job analytics chart. Totals are also kept on `JobPosting.stats` so list views
// never have to count these.

import { Schema, model, Document, Types } from "mongoose";

export const JOB_EVENT_TYPES = ["view", "apply_start"] as const;

export interface IJobEvent extends Document {
  _id: Types.ObjectId;
  orgId: Types.ObjectId;
  jobId: Types.ObjectId;
  type: (typeof JOB_EVENT_TYPES)[number];
  userId?: Types.ObjectId;
  source?: string;
  createdAt: Date;
}

const JobEventSchema = new Schema<IJobEvent>(
  {
    orgId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    jobId: { type: Schema.Types.ObjectId, ref: "JobPosting", required: true },
    type: { type: String, enum: JOB_EVENT_TYPES, required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User" },
    source: { type: String, maxlength: 40 },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

JobEventSchema.index({ jobId: 1, type: 1, createdAt: -1 });

export const JobEvent = model<IJobEvent>("JobEvent", JobEventSchema);
