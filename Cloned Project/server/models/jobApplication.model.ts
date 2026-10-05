// src/models/jobApplication.model.ts
//
// One candidate's application to one JobPosting. A draft (the candidate saved
// and left mid-form) is the same document with `isDraft: true`, so finishing it
// later never creates a duplicate — `{ jobId, candidateId }` is unique.
//
// `profile` is a snapshot of what the candidate submitted, not a live link to
// their Garage profile: the hiring team must see what was actually sent.

import { Schema, model, Document, Types } from "mongoose";
import { STAGE_CATEGORIES, StageCategory } from "./jobPosting.model";

export const APPLICATION_STATUSES = ["active", "rejected", "withdrawn", "hired"] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

/** Where the candidate came from — shown as "Source" across the founder views. */
export const APPLICATION_SOURCES = [
  "garage_hq",
  "university",
  "public_link",
  "careers_page",
  "referral",
  "talent_pool",
] as const;
export type ApplicationSource = (typeof APPLICATION_SOURCES)[number];

export interface IJobAnswerFile {
  url: string;
  name: string;
  size?: number;
  type?: string;
}

export interface IJobAnswer {
  fieldId: string;
  /** string | number | boolean | string[] depending on the field type. */
  value?: any;
  files: IJobAnswerFile[];
}

export interface IJobApplication extends Document {
  _id: Types.ObjectId;
  jobId: Types.ObjectId;
  orgId: Types.ObjectId;
  candidateId: Types.ObjectId;

  /** Human reference shown to the candidate, e.g. "NW-APP-8812". */
  reference: string;

  isDraft: boolean;
  /** Last form page the candidate reached (0-based) — drives drop-off analytics. */
  furthestPage: number;

  stageId: string;
  stageCategory: StageCategory;
  /**
   * Furthest stage category ever reached (index into STAGE_CATEGORIES). A
   * rejected candidate keeps it, which is what lets the hiring funnel count
   * "reached Interview" rather than only "is in Interview right now".
   */
  maxStageRank: number;
  status: ApplicationStatus;

  answers: IJobAnswer[];
  profile: {
    fullName?: string;
    /** Current role, e.g. "Lead Designer". */
    title?: string;
    email?: string;
    phone?: string;
    location?: string;
    company?: string;
    experienceYears?: number;
    currentCtc?: string;
    expectedCtc?: string;
    noticePeriod?: string;
    linkedin?: string;
  };
  resume?: IJobAnswerFile;

  source: ApplicationSource;
  /** Set when the candidate arrived through someone's referral link. */
  referral?: {
    referrerId: Types.ObjectId;
    affiliateId: string;
  };

  matchScore: number;
  /** Job skills found in what the candidate submitted — shown as their top skills. */
  matchedSkills: string[];
  quiz?: { score: number; total: number; passed: boolean };
  knockout?: { triggered: boolean; fieldId?: string; reason?: string };

  rejection?: {
    reason?: string;
    note?: string;
    at: Date;
    by?: Types.ObjectId;
    /** Rejection email is delayed per the job's settings; the sweeper sends it. */
    emailDueAt?: Date;
    emailSentAt?: Date;
  };

  tags: string[];
  starred: boolean;
  /** First time anyone on the hiring team opened it — "new" means unset. */
  reviewedAt?: Date;

  talentPoolConsent: boolean;
  consentUntil?: Date;

  joiningDate?: Date;
  hiredAt?: Date;

  appliedAt?: Date;
  stageEnteredAt?: Date;
  lastActivityAt: Date;
  lastActivity?: string;
  /**
   * When the stage owner was last reminded that this application went idle
   * (stage auto-action "no action for N days"). Earlier than `stageEnteredAt`
   * means the reminder belonged to a previous stage, so a new one may go out.
   */
  idleRemindedAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}

const FileSchema = new Schema<IJobAnswerFile>(
  {
    url: { type: String, required: true },
    name: { type: String, default: "" },
    size: { type: Number },
    type: { type: String },
  },
  { _id: false }
);

const AnswerSchema = new Schema<IJobAnswer>(
  {
    fieldId: { type: String, required: true },
    value: { type: Schema.Types.Mixed },
    files: { type: [FileSchema], default: [] },
  },
  { _id: false }
);

const JobApplicationSchema = new Schema<IJobApplication>(
  {
    jobId: { type: Schema.Types.ObjectId, ref: "JobPosting", required: true },
    orgId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    candidateId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    reference: { type: String, required: true },

    isDraft: { type: Boolean, default: true },
    furthestPage: { type: Number, default: 0 },

    stageId: { type: String, default: "" },
    stageCategory: { type: String, enum: STAGE_CATEGORIES, default: "applied" },
    maxStageRank: { type: Number, default: 0, min: 0, max: STAGE_CATEGORIES.length - 1 },
    status: { type: String, enum: APPLICATION_STATUSES, default: "active" },

    answers: { type: [AnswerSchema], default: [] },
    profile: {
      fullName: { type: String, trim: true, maxlength: 160 },
      title: { type: String, trim: true, maxlength: 160 },
      email: { type: String, trim: true, maxlength: 200 },
      phone: { type: String, trim: true, maxlength: 40 },
      location: { type: String, trim: true, maxlength: 160 },
      company: { type: String, trim: true, maxlength: 160 },
      experienceYears: { type: Number, min: 0, max: 70 },
      currentCtc: { type: String, trim: true, maxlength: 60 },
      expectedCtc: { type: String, trim: true, maxlength: 60 },
      noticePeriod: { type: String, trim: true, maxlength: 60 },
      linkedin: { type: String, trim: true, maxlength: 300 },
    },
    resume: { type: FileSchema },

    source: { type: String, enum: APPLICATION_SOURCES, default: "garage_hq" },
    referral: {
      type: new Schema(
        {
          referrerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
          affiliateId: { type: String, required: true },
        },
        { _id: false }
      ),
    },

    matchScore: { type: Number, default: 0, min: 0, max: 100 },
    matchedSkills: { type: [String], default: [] },
    quiz: {
      type: new Schema(
        { score: Number, total: Number, passed: Boolean },
        { _id: false }
      ),
    },
    knockout: {
      type: new Schema(
        { triggered: Boolean, fieldId: String, reason: String },
        { _id: false }
      ),
    },

    rejection: {
      type: new Schema(
        {
          reason: String,
          note: String,
          at: { type: Date, required: true },
          by: { type: Schema.Types.ObjectId, ref: "User" },
          emailDueAt: Date,
          emailSentAt: Date,
        },
        { _id: false }
      ),
    },

    tags: { type: [String], default: [] },
    starred: { type: Boolean, default: false },
    reviewedAt: { type: Date },

    talentPoolConsent: { type: Boolean, default: false },
    consentUntil: { type: Date },

    joiningDate: { type: Date },
    hiredAt: { type: Date },

    appliedAt: { type: Date },
    stageEnteredAt: { type: Date },
    lastActivityAt: { type: Date, default: () => new Date() },
    lastActivity: { type: String },
    idleRemindedAt: { type: Date },
  },
  { timestamps: true }
);

JobApplicationSchema.index({ jobId: 1, candidateId: 1 }, { unique: true });
JobApplicationSchema.index({ orgId: 1, isDraft: 1, appliedAt: -1 });
JobApplicationSchema.index({ jobId: 1, isDraft: 1, stageId: 1 });
JobApplicationSchema.index({ candidateId: 1, updatedAt: -1 });
JobApplicationSchema.index({ orgId: 1, talentPoolConsent: 1 });
// Sweeper: delayed rejection emails.
JobApplicationSchema.index({ "rejection.emailDueAt": 1 }, { sparse: true });

export const JobApplication = model<IJobApplication>(
  "JobApplication",
  JobApplicationSchema
);
