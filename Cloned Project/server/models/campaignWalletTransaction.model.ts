// src/models/campaignWalletTransaction.model.ts
// Audit log for the per-campaign escrow wallet. One row per balance change.
// `relatedTransactionId` links to the paired StoreWalletTransaction (on lock
// or refund) or ContentRewardsWalletTransaction (on payout).

import mongoose, { Schema, Document, Types } from "mongoose";

export const CAMPAIGN_WALLET_TX_TYPES = ["credit", "debit", "refund"] as const;
export type CampaignWalletTxType = (typeof CAMPAIGN_WALLET_TX_TYPES)[number];

export const CAMPAIGN_WALLET_TX_DIRECTIONS = ["in", "out"] as const;
export type CampaignWalletTxDirection = (typeof CAMPAIGN_WALLET_TX_DIRECTIONS)[number];

export interface ICampaignWalletTransaction extends Document {
  _id: Types.ObjectId;
  campaignWalletId: Types.ObjectId;
  campaignId: Types.ObjectId;
  orgId: Types.ObjectId;

  type: CampaignWalletTxType;
  direction: CampaignWalletTxDirection;
  amount: number;             // float USD
  currency: string;
  balanceBefore: number;
  balanceAfter: number;

  description: string;
  relatedUserId: Types.ObjectId | null;          // founder for credit/refund, affiliate for debit
  relatedSubmissionId: Types.ObjectId | null;    // for payout debits
  relatedPayoutId: Types.ObjectId | null;        // links to ContentPayout
  relatedTransactionId: Types.ObjectId | null;   // paired wallet tx (Store / ContentRewards)
  metadata: any;
  status: string;

  createdAt: Date;
  updatedAt: Date;
}

const CampaignWalletTransactionSchema = new Schema<ICampaignWalletTransaction>(
  {
    campaignWalletId: {
      type: Schema.Types.ObjectId,
      ref: "CampaignWallet",
      required: true,
      index: true,
    },
    campaignId: {
      type: Schema.Types.ObjectId,
      ref: "ContentCampaign",
      required: true,
      index: true,
    },
    orgId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },

    type: {
      type: String,
      enum: CAMPAIGN_WALLET_TX_TYPES,
      required: true,
      index: true,
    },
    direction: {
      type: String,
      enum: CAMPAIGN_WALLET_TX_DIRECTIONS,
      required: true,
    },
    amount: { type: Number, required: true, min: 0.01 },
    currency: { type: String, default: "USD" },
    balanceBefore: { type: Number, required: true },
    balanceAfter: { type: Number, required: true },

    description: { type: String, required: true, trim: true, maxlength: 500 },
    relatedUserId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    relatedSubmissionId: {
      type: Schema.Types.ObjectId,
      ref: "ContentSubmission",
      default: null,
    },
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

CampaignWalletTransactionSchema.index({ campaignWalletId: 1, createdAt: -1 });
CampaignWalletTransactionSchema.index({ campaignId: 1, createdAt: -1 });
CampaignWalletTransactionSchema.index({ orgId: 1, type: 1, createdAt: -1 });

export const CampaignWalletTransaction =
  mongoose.model<ICampaignWalletTransaction>(
    "CampaignWalletTransaction",
    CampaignWalletTransactionSchema
  );
