// src/models/jobInterview.model.ts
//
// An interview round for one application, plus each interviewer's scorecard.
//
// The founder either fixes a time (`scheduledAt` set immediately) or offers up
// to six slots and lets the candidate pick one (`candidatePicks`), in which
// case the round waits in "awaiting_candidate" until the pick lands.

import { Schema, model, Document, Types } from "mongoose";

export const INTERVIEW_STATUSES = [
  "awaiting_candidate",
  "scheduled",
  "completed",
  "cancelled",
] as const;
export type InterviewStatus = (typeof INTERVIEW_STATUSES)[number];

export const INTERVIEW_MODES = ["video", "in_person", "phone"] as const;

export const RECOMMENDATIONS = ["strong_no", "no", "yes", "strong_yes"] as const;
export type Recommendation = (typeof RECOMMENDATIONS)[number];

export interface IScorecardRating {
  criterion: string;
  /** 1–5 */
  score: number;
  note?: string;
}

export interface IScorecard {
  interviewerId: Types.ObjectId;
  ratings: IScorecardRating[];
  recommendation?: Recommendation;
  privateNote?: string;
  submittedAt?: Date;
}

export interface IJobInterview extends Document {
  _id: Types.ObjectId;
  orgId: Types.ObjectId;
  jobId: Types.ObjectId;
  applicationId: Types.ObjectId;
  candidateId: Types.ObjectId;
  /** The pipeline stage this round belongs to. */
  stageId: string;
  roundLabel: string;
  interviewerIds: Types.ObjectId[];
  mode: (typeof INTERVIEW_MODES)[number];
  durationMin: number;
  timezone?: string;
  slots: Date[];
  candidatePicks: boolean;
  scheduledAt?: Date;
  meetingUrl?: string;
  location?: string;
  message?: string;
  status: InterviewStatus;
  scorecards: IScorecard[];
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const RatingSchema = new Schema<IScorecardRating>(
  {
    criterion: { type: String, required: true, maxlength: 120 },
    score: { type: Number, min: 1, max: 5, required: true },
    note: { type: String, maxlength: 2000 },
  },
  { _id: false }
);

const ScorecardSchema = new Schema<IScorecard>(
  {
    interviewerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    ratings: { type: [RatingSchema], default: [] },
    recommendation: { type: String, enum: RECOMMENDATIONS },
    privateNote: { type: String, maxlength: 4000 },
    submittedAt: { type: Date },
  },
  { _id: false }
);

const JobInterviewSchema = new Schema<IJobInterview>(
  {
    orgId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    jobId: { type: Schema.Types.ObjectId, ref: "JobPosting", required: true },
    applicationId: {
      type: Schema.Types.ObjectId,
      ref: "JobApplication",
      required: true,
    },
    candidateId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    stageId: { type: String, default: "" },
    roundLabel: { type: String, default: "Interview", maxlength: 120 },
    interviewerIds: [{ type: Schema.Types.ObjectId, ref: "User" }],
    mode: { type: String, enum: INTERVIEW_MODES, default: "video" },
    durationMin: { type: Number, default: 45, min: 5, max: 480 },
    timezone: { type: String },
    slots: { type: [Date], default: [] },
    candidatePicks: { type: Boolean, default: false },
    scheduledAt: { type: Date },
    meetingUrl: { type: String },
    location: { type: String, maxlength: 300 },
    message: { type: String, maxlength: 4000 },
    status: { type: String, enum: INTERVIEW_STATUSES, default: "scheduled" },
    scorecards: { type: [ScorecardSchema], default: [] },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

JobInterviewSchema.index({ applicationId: 1, createdAt: -1 });
JobInterviewSchema.index({ orgId: 1, status: 1, scheduledAt: 1 });
JobInterviewSchema.index({ candidateId: 1, status: 1 });

export const JobInterview = model<IJobInterview>("JobInterview", JobInterviewSchema);
