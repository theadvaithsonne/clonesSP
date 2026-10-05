// src/models/jobActivity.model.ts
//
// The timeline of one application: every stage move, score, interview, offer
// and internal note. Notes live here too (type "note") so the profile drawer's
// Activity and Notes tabs read one collection; the candidate never sees any of it.

import { Schema, model, Document, Types } from "mongoose";

export const JOB_ACTIVITY_TYPES = [
  "applied",
  "auto_scored",
  "knockout",
  "stage_moved",
  "rejected",
  "withdrawn",
  "note",
  "tagged",
  "interview_scheduled",
  "interview_slot_picked",
  "interview_cancelled",
  "scorecard_submitted",
  "offer_sent",
  "offer_accepted",
  "offer_declined",
  "hired",
  "left_early",
  "email_sent",
  "invited",
] as const;
export type JobActivityType = (typeof JOB_ACTIVITY_TYPES)[number];

export interface IJobActivity extends Document {
  _id: Types.ObjectId;
  orgId: Types.ObjectId;
  jobId: Types.ObjectId;
  applicationId: Types.ObjectId;
  /** Absent for system events (auto-scoring, knockouts, the sweeper). */
  actorId?: Types.ObjectId;
  type: JobActivityType;
  text: string;
  mentions: Types.ObjectId[];
  data?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const JobActivitySchema = new Schema<IJobActivity>(
  {
    orgId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    jobId: { type: Schema.Types.ObjectId, ref: "JobPosting", required: true },
    applicationId: {
      type: Schema.Types.ObjectId,
      ref: "JobApplication",
      required: true,
    },
    actorId: { type: Schema.Types.ObjectId, ref: "User" },
    type: { type: String, enum: JOB_ACTIVITY_TYPES, required: true },
    text: { type: String, default: "", maxlength: 4000 },
    mentions: [{ type: Schema.Types.ObjectId, ref: "User" }],
    data: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

JobActivitySchema.index({ applicationId: 1, createdAt: -1 });
JobActivitySchema.index({ orgId: 1, createdAt: -1 });

export const JobActivity = model<IJobActivity>("JobActivity", JobActivitySchema);
