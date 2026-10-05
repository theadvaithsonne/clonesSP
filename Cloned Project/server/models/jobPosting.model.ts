// src/models/jobPosting.model.ts
//
// A role an office (organization) is hiring for — the core record of the Garage
// Jobs module. One document carries everything the six-step "Post a job" wizard
// edits: basics, description, the application form, the hiring pipeline and
// team, the referral reward and where/when the role is published.
//
// The application form, stages and team are embedded rather than split into
// their own collections: they are always read and written together with the
// posting, and a published application is judged against the form exactly as
// it stood, so there is never a second source of truth to reconcile.

import { installCatalogHooks } from "./_catalogHooks";
import { Schema, model, Document, Types } from "mongoose";

export const JOB_STATUSES = [
  "draft",
  "scheduled",
  "live",
  "paused",
  "closed",
  "filled",
  "expired",
] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export const EMPLOYMENT_TYPES = [
  "full_time",
  "part_time",
  "contract",
  "internship",
] as const;
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];

export const WORKPLACE_TYPES = ["hybrid", "remote", "onsite"] as const;
export type WorkplaceType = (typeof WORKPLACE_TYPES)[number];

/**
 * Every custom stage belongs to one of these fixed categories. Candidates only
 * ever see the category (their progress bar), never the founder's stage names,
 * and the overview funnel is counted by category across jobs.
 */
export const STAGE_CATEGORIES = [
  "applied",
  "screening",
  "assessment",
  "interview",
  "offer",
  "hired",
] as const;
export type StageCategory = (typeof STAGE_CATEGORIES)[number];

export const TEAM_ROLES = ["hiring_manager", "recruiter", "interviewer"] as const;
export type TeamRole = (typeof TEAM_ROLES)[number];

/** Everything the application form builder can place on a page. */
export const JOB_FIELD_TYPES = [
  // Basic
  "short_text",
  "long_text",
  "number",
  "email",
  "phone",
  "date",
  "url",
  // Choice
  "single_choice",
  "checkboxes",
  "dropdown",
  "yes_no",
  "rating",
  "ranking",
  // Files
  "resume",
  "file_upload",
  "portfolio_link",
  "video_answer",
  // Assessment
  "quiz_mcq",
  // Profile — prefilled from the candidate's Garage profile
  "profile_full_name",
  "profile_email",
  "profile_phone",
  "profile_location",
  "profile_company",
  "profile_experience",
  "profile_current_ctc",
  "profile_expected_ctc",
  "profile_notice_period",
  "profile_linkedin",
  // Layout
  "section_heading",
  "info_text",
  "declaration",
] as const;
export type JobFieldType = (typeof JOB_FIELD_TYPES)[number];

export const CONDITION_OPERATORS = [
  "equals",
  "not_equals",
  "greater_than",
  "less_than",
  "contains",
] as const;
export type ConditionOperator = (typeof CONDITION_OPERATORS)[number];

export interface IJobFieldOption {
  id: string;
  label: string;
}

/** "If the answer is X, reject automatically" — evaluated when a page is submitted. */
export interface IJobKnockout {
  enabled: boolean;
  /** Option id, or "yes" / "no" for yes_no fields. */
  answer: string;
  moveToRejected: boolean;
  addReason: boolean;
  reason?: string;
  notifyTeam: boolean;
  /** Rejection email template id from JobsSettings. */
  emailTemplateId?: string;
  delayEmail: boolean;
}

/** "Show this field only if <field> <operator> <value>". */
export interface IJobFieldCondition {
  fieldId: string;
  operator: ConditionOperator;
  value: string;
  hideUntilMet: boolean;
  clearIfHidden: boolean;
}

export interface IJobFormField {
  /** Stable key — answers are stored against it, so it never changes. */
  id: string;
  type: JobFieldType;
  label: string;
  helpText?: string;
  required: boolean;
  /** Locked fields (the consent declaration) cannot be removed or made optional. */
  locked: boolean;
  options: IJobFieldOption[];
  /** Files */
  fileTypes: string[];
  maxSizeMb?: number;
  multiple: boolean;
  parseResume: boolean;
  /** Rating scale upper bound (1..scaleMax). */
  scaleMax?: number;
  /** Long-text character limit. */
  maxLength?: number;
  /** Quiz */
  correctOptionId?: string;
  points?: number;
  /** A declaration that opts the candidate into the talent pool. */
  talentPoolConsent: boolean;
  knockout?: IJobKnockout;
  condition?: IJobFieldCondition;
}

export interface IJobFormPage {
  id: string;
  title: string;
  description?: string;
  /** Timed section — the whole page must be answered within this many minutes. */
  timeLimitMinutes?: number;
  /** Quiz pass mark (number of correct answers on this page). */
  passMark?: number;
  fields: IJobFormField[];
}

export const AUTO_ACTION_TRIGGERS = ["on_enter", "quiz_score_gte", "idle_days"] as const;
export const AUTO_ACTION_KINDS = ["send_email", "move_to_stage", "remind_owner"] as const;

export interface IJobAutoAction {
  id: string;
  trigger: (typeof AUTO_ACTION_TRIGGERS)[number];
  /** Score for quiz_score_gte, days for idle_days. */
  value?: number;
  action: (typeof AUTO_ACTION_KINDS)[number];
  targetStageId?: string;
  emailTemplateId?: string;
}

export interface IJobStage {
  id: string;
  name: string;
  category: StageCategory;
  ownerId?: Types.ObjectId;
  autoActions: IJobAutoAction[];
}

export interface IJobTeamMember {
  userId: Types.ObjectId;
  role: TeamRole;
}

export interface IJobCandidateEmails {
  applicationReceived: boolean;
  movedToInterview: boolean;
  rejection: boolean;
  rejectionDelayHours: number;
  offer: boolean;
}

export interface IJobReward {
  enabled: boolean;
  /** USD per successful hire. */
  amount: number;
  guaranteeDays: number;
  /** "hold" reserves amount × openings at publish; "on_hire" charges per hire. */
  funding: "hold" | "on_hire";
  /** What is still reserved from the founder's GaragePay wallet. */
  heldAmount: number;
  /** Total ever reserved for this posting (for the payouts ledger). */
  totalHeld: number;
  /** Whose GaragePay wallet funds this posting's rewards (set at publish). */
  payerId?: Types.ObjectId;
}

export interface IJobPosting extends Document {
  _id: Types.ObjectId;
  orgId: Types.ObjectId;
  createdBy: Types.ObjectId;
  status: JobStatus;
  slug: string;

  // Step 1 — basics
  title: string;
  department?: string;
  openings: number;
  employmentType: EmploymentType;
  workplace: WorkplaceType;
  officeDays?: number;
  locations: string[];
  experienceMin?: number;
  experienceMax?: number;
  joining?: string;
  salary: {
    show: boolean;
    currency: string;
    min?: number;
    max?: number;
    period: "year" | "month" | "hour";
  };

  // Step 2 — description
  description: {
    aboutRole: string;
    responsibilities: string;
    requirements: string;
    niceToHave: string;
    offer: string;
  };
  skills: string[];
  education: { required: boolean; qualification?: string };
  perks: string[];

  // Step 3 — application form
  form: { pages: IJobFormPage[] };

  // Step 4 — pipeline & team
  stages: IJobStage[];
  team: IJobTeamMember[];
  candidateEmails: IJobCandidateEmails;

  // Step 5 — referral reward
  reward: IJobReward;

  // Step 6 — publish
  channels: { garageHq: boolean; university: boolean; publicLink: boolean };
  publishMode: "now" | "scheduled";
  publishAt?: Date;
  closesAt?: Date;
  autoCloseOnHires: boolean;

  /** Wizard progress: highest step (1–6) the founder has completed. */
  completedStep: number;

  stats: { views: number; applyStarts: number };

  publishedAt?: Date;
  closedAt?: Date;
  /**
   * Deleting a posting that already has applicants only hides it: candidate
   * records stay in the talent pool and keep pointing at a real job.
   */
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const OptionSchema = new Schema<IJobFieldOption>(
  { id: { type: String, required: true }, label: { type: String, default: "" } },
  { _id: false }
);

const KnockoutSchema = new Schema<IJobKnockout>(
  {
    enabled: { type: Boolean, default: false },
    answer: { type: String, default: "" },
    moveToRejected: { type: Boolean, default: true },
    addReason: { type: Boolean, default: true },
    reason: { type: String },
    notifyTeam: { type: Boolean, default: false },
    emailTemplateId: { type: String },
    delayEmail: { type: Boolean, default: true },
  },
  { _id: false }
);

const ConditionSchema = new Schema<IJobFieldCondition>(
  {
    fieldId: { type: String, required: true },
    operator: { type: String, enum: CONDITION_OPERATORS, default: "equals" },
    value: { type: String, default: "" },
    hideUntilMet: { type: Boolean, default: true },
    clearIfHidden: { type: Boolean, default: true },
  },
  { _id: false }
);

const FieldSchema = new Schema<IJobFormField>(
  {
    id: { type: String, required: true },
    type: { type: String, enum: JOB_FIELD_TYPES, required: true },
    label: { type: String, default: "" },
    helpText: { type: String },
    required: { type: Boolean, default: false },
    locked: { type: Boolean, default: false },
    options: { type: [OptionSchema], default: [] },
    fileTypes: { type: [String], default: [] },
    maxSizeMb: { type: Number },
    multiple: { type: Boolean, default: false },
    parseResume: { type: Boolean, default: false },
    scaleMax: { type: Number },
    maxLength: { type: Number },
    correctOptionId: { type: String },
    points: { type: Number },
    talentPoolConsent: { type: Boolean, default: false },
    knockout: { type: KnockoutSchema },
    condition: { type: ConditionSchema },
  },
  { _id: false }
);

const PageSchema = new Schema<IJobFormPage>(
  {
    id: { type: String, required: true },
    title: { type: String, default: "" },
    description: { type: String },
    timeLimitMinutes: { type: Number },
    passMark: { type: Number },
    fields: { type: [FieldSchema], default: [] },
  },
  { _id: false }
);

const AutoActionSchema = new Schema<IJobAutoAction>(
  {
    id: { type: String, required: true },
    trigger: { type: String, enum: AUTO_ACTION_TRIGGERS, required: true },
    value: { type: Number },
    action: { type: String, enum: AUTO_ACTION_KINDS, required: true },
    targetStageId: { type: String },
    emailTemplateId: { type: String },
  },
  { _id: false }
);

const StageSchema = new Schema<IJobStage>(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    category: { type: String, enum: STAGE_CATEGORIES, required: true },
    ownerId: { type: Schema.Types.ObjectId, ref: "User" },
    autoActions: { type: [AutoActionSchema], default: [] },
  },
  { _id: false }
);

const TeamMemberSchema = new Schema<IJobTeamMember>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    role: { type: String, enum: TEAM_ROLES, required: true },
  },
  { _id: false }
);

const JobPostingSchema = new Schema<IJobPosting>(
  {
    orgId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    status: { type: String, enum: JOB_STATUSES, default: "draft" },
    slug: { type: String, required: true },

    title: { type: String, default: "", trim: true, maxlength: 160 },
    department: { type: String, trim: true, maxlength: 80 },
    openings: { type: Number, default: 1, min: 1, max: 500 },
    employmentType: { type: String, enum: EMPLOYMENT_TYPES, default: "full_time" },
    workplace: { type: String, enum: WORKPLACE_TYPES, default: "onsite" },
    officeDays: { type: Number, min: 1, max: 7 },
    locations: { type: [String], default: [] },
    experienceMin: { type: Number, min: 0, max: 60 },
    experienceMax: { type: Number, min: 0, max: 60 },
    joining: { type: String, trim: true, maxlength: 80 },
    salary: {
      show: { type: Boolean, default: true },
      currency: { type: String, default: "USD" },
      min: { type: Number, min: 0 },
      max: { type: Number, min: 0 },
      period: { type: String, enum: ["year", "month", "hour"], default: "year" },
    },

    description: {
      aboutRole: { type: String, default: "" },
      responsibilities: { type: String, default: "" },
      requirements: { type: String, default: "" },
      niceToHave: { type: String, default: "" },
      offer: { type: String, default: "" },
    },
    skills: { type: [String], default: [] },
    education: {
      required: { type: Boolean, default: false },
      qualification: { type: String, trim: true, maxlength: 120 },
    },
    perks: { type: [String], default: [] },

    form: {
      pages: { type: [PageSchema], default: [] },
    },

    stages: { type: [StageSchema], default: [] },
    team: { type: [TeamMemberSchema], default: [] },
    candidateEmails: {
      applicationReceived: { type: Boolean, default: true },
      movedToInterview: { type: Boolean, default: true },
      rejection: { type: Boolean, default: true },
      rejectionDelayHours: { type: Number, default: 24, min: 0, max: 168 },
      offer: { type: Boolean, default: false },
    },

    reward: {
      enabled: { type: Boolean, default: false },
      amount: { type: Number, default: 0, min: 0 },
      guaranteeDays: { type: Number, default: 90, enum: [30, 60, 90] },
      funding: { type: String, enum: ["hold", "on_hire"], default: "hold" },
      heldAmount: { type: Number, default: 0, min: 0 },
      totalHeld: { type: Number, default: 0, min: 0 },
      payerId: { type: Schema.Types.ObjectId, ref: "User" },
    },

    channels: {
      garageHq: { type: Boolean, default: true },
      university: { type: Boolean, default: false },
      publicLink: { type: Boolean, default: true },
    },
    publishMode: { type: String, enum: ["now", "scheduled"], default: "now" },
    publishAt: { type: Date },
    closesAt: { type: Date },
    autoCloseOnHires: { type: Boolean, default: true },

    completedStep: { type: Number, default: 0, min: 0, max: 6 },

    stats: {
      views: { type: Number, default: 0 },
      applyStarts: { type: Number, default: 0 },
    },

    publishedAt: { type: Date },
    closedAt: { type: Date },
    deletedAt: { type: Date },
  },
  { timestamps: true }
);

JobPostingSchema.index({ orgId: 1, status: 1, updatedAt: -1 });
JobPostingSchema.index({ orgId: 1, slug: 1 }, { unique: true });
// Discover: every live posting visible to Garage members, newest first.
JobPostingSchema.index({ status: 1, "channels.garageHq": 1, publishedAt: -1 });
// Sweeper: scheduled publishes and closing dates.
JobPostingSchema.index({ status: 1, publishAt: 1 });
JobPostingSchema.index({ status: 1, closesAt: 1 });

// Every save, update and delete enqueues a catalog-outbox row, which is what
// puts a job in front of EarnGPT and the opportunity matcher. Without this a
// posting is only ever visible to someone already browsing Jobs.
installCatalogHooks(JobPostingSchema, "job");

export const JobPosting = model<IJobPosting>("JobPosting", JobPostingSchema);
