// src/models/contentRewardsWallet.model.ts
// Per-user wallet that holds Content Rewards earnings credited from
// CampaignWallets. Segregated from AffiliateWallet (which is for unilevel
// commissions) so balances and any future withdrawal flow stay independent.

import mongoose, { Schema, Document, Types } from "mongoose";

export interface IContentRewardsWallet extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;

  balance: number;          // float USD
  currency: string;
  totalEarnings: number;    // lifetime sum credited
  totalWithdrawn: number;   // reserved for future withdrawal flow
  isActive: boolean;
  lastTransactionAt: Date | null;

  createdAt: Date;
  updatedAt: Date;
}

const ContentRewardsWalletSchema = new Schema<IContentRewardsWallet>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    balance: { type: Number, required: true, default: 0, min: 0 },
    currency: { type: String, default: "USD" },
    totalEarnings: { type: Number, default: 0, min: 0 },
    totalWithdrawn: { type: Number, default: 0, min: 0 },
    isActive: { type: Boolean, default: true },
    lastTransactionAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export const ContentRewardsWallet = mongoose.model<IContentRewardsWallet>(
  "ContentRewardsWallet",
  ContentRewardsWalletSchema
);
