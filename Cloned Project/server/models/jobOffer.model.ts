// src/models/jobOffer.model.ts
//
// An offer sent to a candidate. The candidate accepts or declines it inside
// Garage; accepting does not mark them hired — the founder confirms the hire
// (and the joining date that starts any referral guarantee) separately.

import { Schema, model, Document, Types } from "mongoose";

export const OFFER_STATUSES = ["sent", "accepted", "declined", "withdrawn", "expired"] as const;
export type OfferStatus = (typeof OFFER_STATUSES)[number];

export interface IJobOffer extends Document {
  _id: Types.ObjectId;
  orgId: Types.ObjectId;
  jobId: Types.ObjectId;
  applicationId: Types.ObjectId;
  candidateId: Types.ObjectId;
  role: string;
  ctc: number;
  currency: string;
  joiningDate?: Date;
  expiresAt?: Date;
  letter?: { url: string; name: string; size?: number };
  message?: string;
  status: OfferStatus;
  respondedAt?: Date;
  declineReason?: string;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const JobOfferSchema = new Schema<IJobOffer>(
  {
    orgId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    jobId: { type: Schema.Types.ObjectId, ref: "JobPosting", required: true },
    applicationId: {
      type: Schema.Types.ObjectId,
      ref: "JobApplication",
      required: true,
    },
    candidateId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    role: { type: String, required: true, maxlength: 160 },
    ctc: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "USD" },
    joiningDate: { type: Date },
    expiresAt: { type: Date },
    letter: {
      type: new Schema(
        { url: { type: String, required: true }, name: String, size: Number },
        { _id: false }
      ),
    },
    message: { type: String, maxlength: 4000 },
    status: { type: String, enum: OFFER_STATUSES, default: "sent" },
    respondedAt: { type: Date },
    declineReason: { type: String, maxlength: 1000 },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

JobOfferSchema.index({ applicationId: 1, createdAt: -1 });
JobOfferSchema.index({ candidateId: 1, status: 1 });

export const JobOffer = model<IJobOffer>("JobOffer", JobOfferSchema);
