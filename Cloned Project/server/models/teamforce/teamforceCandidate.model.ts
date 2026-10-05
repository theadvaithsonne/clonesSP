import { Schema, model, Types } from "mongoose";

export const CANDIDATE_STAGES = [
  "applied",
  "reviewing",
  "shortlisted",
  "interview",
  "offer",
  "hired",
  "rejected",
] as const;

export type CandidateStage = (typeof CANDIDATE_STAGES)[number];

const CustomFieldValueSchema = new Schema(
  {
    fieldId: { type: String, required: true },
    label: { type: String, required: true },
    type: { type: String, enum: ["text", "number", "upload"], required: true },
    value: { type: String, default: "" },
    fileKey: { type: String, default: "" },
    fileName: { type: String, default: "" },
    fileContentType: { type: String, default: "" },
    fileSize: { type: Number, default: 0 },
  },
  { _id: false }
);

const TeamforceCandidateSchema = new Schema(
  {
    orgId: { type: Types.ObjectId, ref: "Organization", required: true, index: true },
    recruitmentRequestId: {
      type: Types.ObjectId,
      ref: "TeamforceRecruitmentRequest",
      required: true,
      index: true,
    },

    // Snapshot of the position at time of application — keeps pipeline
    // data intact even if the request is later edited/closed.
    positionName: { type: String, required: true, trim: true },
    department: { type: String, default: "", trim: true },
    jobLocation: { type: String, default: "", trim: true },

    // Applicant
    fullName: { type: String, required: true, trim: true },
    mobileNumber: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true, index: true },
    yearsOfExperience: { type: Number, required: true, min: 0, default: 0 },
    experienceDetails: { type: String, default: "" },
    currentCtc: { type: String, default: "" },
    expectedCtc: { type: String, default: "" },
    noticePeriod: { type: String, default: "" },

    // Resume (stored in S3 — we keep only the key + metadata)
    resumeKey: { type: String, required: true },
    resumeFileName: { type: String, required: true },
    resumeContentType: { type: String, default: "application/octet-stream" },
    resumeSize: { type: Number, default: 0 },

    // Answers submitted for any custom fields published on the recruitment
    // request at the time of application.
    customFieldValues: { type: [CustomFieldValueSchema], default: [] },

    stage: { type: String, enum: CANDIDATE_STAGES, default: "applied", index: true },
    notes: { type: String, default: "" },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

TeamforceCandidateSchema.index({ orgId: 1, recruitmentRequestId: 1, createdAt: -1 });

export const TeamforceCandidate = model("TeamforceCandidate", TeamforceCandidateSchema);
