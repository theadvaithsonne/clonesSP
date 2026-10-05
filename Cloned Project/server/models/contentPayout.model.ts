// src/models/contentPayout.model.ts
// Payout records for Content Rewards — one record per payout event.
// Links to the affiliate's wallet transaction for auditing.

import mongoose, { Schema, Document, Types } from "mongoose";

export const PAYOUT_STATUSES = ["pending", "processing", "completed", "failed"] as const;
export type PayoutStatus = (typeof PAYOUT_STATUSES)[number];

export interface IContentPayout extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  campaignId: Types.ObjectId;
  submissionId: Types.ObjectId;
  orgId: Types.ObjectId;

  amount: number;              // Payout amount in cents
  viewsRewarded: number;       // How many views this payout covers
  status: PayoutStatus;
  processedAt: Date | null;
  transactionRef: string;      // WalletTransaction ID

  createdAt: Date;
  updatedAt: Date;
}

const ContentPayoutSchema = new Schema<IContentPayout>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    campaignId: {
      type: Schema.Types.ObjectId,
      ref: "ContentCampaign",
      required: true,
      index: true,
    },
    submissionId: {
      type: Schema.Types.ObjectId,
      ref: "ContentSubmission",
      required: true,
      index: true,
    },
    orgId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },

    amount: { type: Number, required: true, min: 0 },
    viewsRewarded: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: PAYOUT_STATUSES,
      default: "pending",
      index: true,
    },
    processedAt: { type: Date, default: null },
    transactionRef: { type: String, default: "" },
  },
  { timestamps: true }
);

// ─── Indexes ───────────────────────────────────────────────────────
ContentPayoutSchema.index(
  { userId: 1, createdAt: -1 },
  { name: "user_payouts_idx" }
);

ContentPayoutSchema.index(
  { campaignId: 1, createdAt: -1 },
  { name: "campaign_payouts_idx" }
);

export const ContentPayout = mongoose.model<IContentPayout>(
  "ContentPayout",
  ContentPayoutSchema
);
