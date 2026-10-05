import { Schema, model, Types } from "mongoose";

export const RECRUITMENT_STATUSES = [
  "draft",
  "approval_pending",
  "approved",
  "floated",
  "closed",
] as const;

export const EMPLOYMENT_TYPES = [
  "Full-Time",
  "Part-Time",
  "Contract",
  "Intern",
] as const;

export const EXPERIENCE_RANGES = ["0-2", "2-5", "5-8", "8+"] as const;

export const CUSTOM_FIELD_TYPES = ["text", "number", "upload"] as const;

const CustomFieldSchema = new Schema(
  {
    id: { type: String, required: true },
    label: { type: String, required: true, trim: true },
    type: { type: String, enum: CUSTOM_FIELD_TYPES, required: true },
    required: { type: Boolean, default: false },
  },
  { _id: false }
);

const TeamforceRecruitmentRequestSchema = new Schema(
  {
    orgId: {
      type: Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },

    // Position Details
    positionName: { type: String, required: true, trim: true },
    department: { type: String, required: true, trim: true },
    branch: { type: String, required: true, trim: true },
    reportingManager: { type: String, required: true, trim: true },
    employmentType: {
      type: String,
      enum: EMPLOYMENT_TYPES,
      default: "Full-Time",
    },
    numberOfOpenings: { type: Number, required: true, min: 1, default: 1 },
    experienceRequired: {
      type: String,
      enum: EXPERIENCE_RANGES,
      required: true,
    },
    jobLocation: { type: String, required: true, trim: true },
    expectedJoiningDate: { type: Date, required: true },

    // Job Description
    roleSummary: { type: String, default: "" },
    keyResponsibilities: { type: String, default: "" },
    requiredSkills: { type: String, default: "" },
    preferredSkills: { type: String, default: "" },

    // Approval — `approver` (single string) is the legacy field kept for
    // backward compatibility. `approvers` is the canonical list and may
    // hold one or more selected approver names (founder/admin/manager).
    approver: { type: String, default: "" },
    approvers: { type: [String], default: [] },

    // Workflow
    status: {
      type: String,
      enum: RECRUITMENT_STATUSES,
      default: "draft",
      index: true,
    },

    // Application Form Builder — custom fields authored by admin / founder.
    // `Draft` is the in-progress version; `Published` is what candidates see.
    customFieldsDraft: { type: [CustomFieldSchema], default: [] },
    customFieldsPublished: { type: [CustomFieldSchema], default: [] },

    createdBy: { type: Types.ObjectId, ref: "User", required: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

TeamforceRecruitmentRequestSchema.index({ orgId: 1, isActive: 1, createdAt: -1 });

export const TeamforceRecruitmentRequest = model(
  "TeamforceRecruitmentRequest",
  TeamforceRecruitmentRequestSchema
);
