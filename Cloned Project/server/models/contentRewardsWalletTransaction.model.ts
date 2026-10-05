// src/models/contentRewardsWalletTransaction.model.ts
// Audit log for ContentRewardsWallet. One row per balance change. The
// `relatedTransactionId` links to the paired CampaignWalletTransaction.

import mongoose, { Schema, Document, Types } from "mongoose";

export const CONTENT_REWARDS_TX_TYPES = [
  "credit",
  "debit",
  "withdrawal",
] as const;
export type ContentRewardsTxType = (typeof CONTENT_REWARDS_TX_TYPES)[number];

export interface IContentRewardsWalletTransaction extends Document {
  _id: Types.ObjectId;
  contentRewardsWalletId: Types.ObjectId;
  userId: Types.ObjectId;
  campaignId: Types.ObjectId | null;
  submissionId: Types.ObjectId | null;
  orgId: Types.ObjectId | null;

  type: ContentRewardsTxType;
  amount: number;             // float USD
  currency: string;
  balanceBefore: number;
  balanceAfter: number;

  description: string;
  relatedPayoutId: Types.ObjectId | null;        // links to ContentPayout
  relatedTransactionId: Types.ObjectId | null;   // paired CampaignWalletTransaction
  metadata: any;
  status: string;

  createdAt: Date;
  updatedAt: Date;
}

const ContentRewardsWalletTransactionSchema =
  new Schema<IContentRewardsWalletTransaction>(
    {
      contentRewardsWalletId: {
        type: Schema.Types.ObjectId,
        ref: "ContentRewardsWallet",
        required: true,
        index: true,
      },
      userId: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true,
      },
      campaignId: {
        type: Schema.Types.ObjectId,
        ref: "ContentCampaign",
        default: null,
        index: true,
      },
      submissionId: {
        type: Schema.Types.ObjectId,
        ref: "ContentSubmission",
        default: null,
        index: true,
      },
      orgId: {
        type: Schema.Types.ObjectId,
        ref: "Organization",
        default: null,
        index: true,
      },

      type: {
        type: String,
        enum: CONTENT_REWARDS_TX_TYPES,
        required: true,
        index: true,
      },
      amount: { type: Number, required: true, min: 0.01 },
      currency: { type: String, default: "USD" },
      balanceBefore: { type: Number, required: true },
      balanceAfter: { type: Number, required: true },

      description: { type: String, required: true, trim: true, maxlength: 500 },
      relatedPayoutId: {
        type: Schema.Types.ObjectId,
        ref: "ContentPayout",
        default: null,
      },
      relatedTransactionId: {
        type: Schema.Types.ObjectId,
        default: null,
      },
      metadata: { type: Schema.Types.Mixed },
      status: {
        type: String,
        enum: ["completed", "pending", "failed", "reversed"],
        default: "completed",
        index: true,
      },
    },
    { timestamps: true }
  );

ContentRewardsWalletTransactionSchema.index({
  contentRewardsWalletId: 1,
  createdAt: -1,
});
ContentRewardsWalletTransactionSchema.index({ userId: 1, createdAt: -1 });
ContentRewardsWalletTransactionSchema.index({ campaignId: 1, createdAt: -1 });

export const ContentRewardsWalletTransaction =
  mongoose.model<IContentRewardsWalletTransaction>(
    "ContentRewardsWalletTransaction",
    ContentRewardsWalletTransactionSchema
  );
