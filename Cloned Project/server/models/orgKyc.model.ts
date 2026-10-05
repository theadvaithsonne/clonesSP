/**
 * Per-office KYC record — one document per organization.
 *
 * A garage admin picks which proofs an office has to produce (PAN card,
 * business address proof, government ID, GST number, plus any custom field
 * they type in). The office founder then fills those in from Manage
 * Organization, and the admin approves or rejects the submission.
 *
 * Separate collection rather than a subdocument on Organization: the
 * Organization doc is read on nearly every request in the app, and KYC is read
 * on two screens. Organization only carries the derived `kycStatus` mirror so
 * a listing can show a badge without a second query.
 */
import mongoose, { Schema, Document, Types } from "mongoose";

/**
 * not_requested — no admin has asked this office for anything yet
 * pending       — requirements set, waiting on the founder
 * submitted     — founder sent it in, waiting on the admin
 * verified      — approved; the office is verified
 * rejected      — admin sent it back; founder can fix and resubmit
 */
export const ORG_KYC_STATUSES = [
  "not_requested",
  "pending",
  "submitted",
  "verified",
  "rejected",
] as const;
export type OrgKycStatus = (typeof ORG_KYC_STATUSES)[number];

/** A file upload, or a typed value (GST number, registration number, …). */
export type OrgKycRequirementKind = "file" | "text";

export type OrgKycSubmissionStatus = "pending" | "approved" | "rejected";

export interface IOrgKycRequirement {
  key: string;
  label: string;
  kind: OrgKycRequirementKind;
  description?: string;
  required: boolean;
  /** False for the four built-ins, true for anything the admin typed in. */
  custom: boolean;
}

export interface IOrgKycSubmission {
  _id: Types.ObjectId;
  requirementKey: string;
  /** Set for kind "file". Object key in the PRIVATE KYC bucket. */
  s3Key?: string;
  filename?: string;
  mimeType?: string;
  size?: number;
  /** Set for kind "text" (e.g. the GST number itself). */
  textValue?: string;
  uploadedBy?: Types.ObjectId;
  uploadedAt: Date;
  status: OrgKycSubmissionStatus;
  reviewNote?: string;
  reviewedAt?: Date;
  reviewedBy?: Types.ObjectId;
}

export interface IOrgKyc extends Document {
  _id: Types.ObjectId;
  orgId: Types.ObjectId;
  status: OrgKycStatus;
  requirements: IOrgKycRequirement[];
  submissions: IOrgKycSubmission[];
  /** Free-text note from the admin shown to the founder (why it bounced). */
  reviewNote?: string;
  requestedAt?: Date;
  requestedBy?: Types.ObjectId;
  submittedAt?: Date;
  reviewedAt?: Date;
  reviewedBy?: Types.ObjectId;
  verifiedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const RequirementSchema = new Schema<IOrgKycRequirement>(
  {
    key: { type: String, required: true },
    label: { type: String, required: true },
    kind: { type: String, enum: ["file", "text"], default: "file" },
    description: { type: String },
    required: { type: Boolean, default: true },
    custom: { type: Boolean, default: false },
  },
  { _id: false }
);

const SubmissionSchema = new Schema<IOrgKycSubmission>({
  requirementKey: { type: String, required: true },
  s3Key: { type: String },
  filename: { type: String },
  mimeType: { type: String },
  size: { type: Number },
  textValue: { type: String },
  uploadedBy: { type: Schema.Types.ObjectId, ref: "User" },
  uploadedAt: { type: Date, default: Date.now },
  status: {
    type: String,
    enum: ["pending", "approved", "rejected"],
    default: "pending",
  },
  reviewNote: { type: String },
  reviewedAt: { type: Date },
  reviewedBy: { type: Schema.Types.ObjectId, ref: "GarageAdmin" },
});

const OrgKycSchema = new Schema<IOrgKyc>(
  {
    orgId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      unique: true,
      index: true,
    },
    status: {
      type: String,
      enum: ORG_KYC_STATUSES,
      default: "not_requested",
      index: true,
    },
    requirements: { type: [RequirementSchema], default: [] },
    submissions: { type: [SubmissionSchema], default: [] },
    reviewNote: { type: String },
    requestedAt: { type: Date },
    requestedBy: { type: Schema.Types.ObjectId, ref: "GarageAdmin" },
    submittedAt: { type: Date },
    reviewedAt: { type: Date },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "GarageAdmin" },
    verifiedAt: { type: Date },
  },
  { timestamps: true }
);

export const OrgKyc =
  (mongoose.models.OrgKyc as mongoose.Model<IOrgKyc>) ||
  mongoose.model<IOrgKyc>("OrgKyc", OrgKycSchema);
