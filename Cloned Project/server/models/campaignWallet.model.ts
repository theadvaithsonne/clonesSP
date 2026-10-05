// src/models/campaignWallet.model.ts
// Per-campaign escrow wallet. Holds the locked budget for a Content Rewards
// campaign. Funded by debiting the founder's StoreWallet at campaign creation.
// Drained by payouts to affiliates' ContentRewardsWallets, or refunded to the
// founder's StoreWallet on archive.

import mongoose, { Schema, Document, Types } from "mongoose";

export const CAMPAIGN_WALLET_STATUSES = ["active", "closed"] as const;
export type CampaignWalletStatus = (typeof CAMPAIGN_WALLET_STATUSES)[number];

export interface ICampaignWallet extends Document {
  _id: Types.ObjectId;
  campaignId: Types.ObjectId;
  orgId: Types.ObjectId;
  founderId: Types.ObjectId;

  balance: number;          // float USD (mirrors StoreWallet/AffiliateWallet)
  currency: string;
  totalLocked: number;      // lifetime sum of credits in
  totalPaidOut: number;     // lifetime sum of debits to affiliates
  totalRefunded: number;    // lifetime sum of refunds to founder
  status: CampaignWalletStatus;
  lastTransactionAt: Date | null;

  createdAt: Date;
  updatedAt: Date;
}

const CampaignWalletSchema = new Schema<ICampaignWallet>(
  {
    campaignId: {
      type: Schema.Types.ObjectId,
      ref: "ContentCampaign",
      required: true,
      unique: true,
      index: true,
    },
    orgId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    founderId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    balance: { type: Number, required: true, default: 0, min: 0 },
    currency: { type: String, default: "USD" },
    totalLocked: { type: Number, default: 0, min: 0 },
    totalPaidOut: { type: Number, default: 0, min: 0 },
    totalRefunded: { type: Number, default: 0, min: 0 },
    status: {
      type: String,
      enum: CAMPAIGN_WALLET_STATUSES,
      default: "active",
      index: true,
    },
    lastTransactionAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export const CampaignWallet = mongoose.model<ICampaignWallet>(
  "CampaignWallet",
  CampaignWalletSchema
);
