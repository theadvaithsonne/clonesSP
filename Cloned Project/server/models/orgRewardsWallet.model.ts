// src/models/orgRewardsWallet.model.ts
//
// Per-(user, org) Content Rewards wallet. This is Garage's own, replacing
// the global `NcWallet` previously used as the Content Rewards balance.
//
// Why a new collection: NcWallet's schema is shared with the NetworkChains
// backend (same Mongo cluster, same `wallets` collection). Adding an
// `orgId` to its unique key would break NC. So Garage-owned per-org
// Content Rewards balance lives here; NC keeps reading/writing `wallets`
// for its own purposes (Garage no longer does, after the cutover).
//
// Unit: balance is cents in USD, matching NcWallet so the migration is 1:1.

import mongoose, { Schema, Document, Types } from "mongoose";

export const ORG_REWARDS_TX_SOURCES = [
  "campaign_payout",
  "store_to_cr_send",
  "self_transfer_to_store",
  "withdrawal",
  "admin_adjust",
  "migration_seed",
] as const;
export type OrgRewardsTxSource = (typeof ORG_REWARDS_TX_SOURCES)[number];

export interface IOrgRewardsWalletTransaction {
  type: "credit" | "debit";
  amount: number; // cents (always positive)
  balanceAfter: number; // cents
  source: OrgRewardsTxSource;
  description: string;
  relatedId?: Types.ObjectId; // payout / source-tx / withdrawal id, useful for joins
  createdAt: Date;
}

export interface IOrgRewardsWallet extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  orgId: Types.ObjectId;
  balance: number; // cents
  totalEarnings: number; // cents — lifetime credits, denormalized for the dashboard
  totalWithdrawn: number; // cents — lifetime withdrawals
  transactions: IOrgRewardsWalletTransaction[];
  createdAt: Date;
  updatedAt: Date;
}

const OrgRewardsWalletTransactionSchema =
  new Schema<IOrgRewardsWalletTransaction>(
    {
      type: { type: String, enum: ["credit", "debit"], required: true },
      amount: { type: Number, required: true, min: 0 },
      balanceAfter: { type: Number, required: true },
      source: {
        type: String,
        enum: ORG_REWARDS_TX_SOURCES,
        required: true,
      },
      description: { type: String, required: true },
      relatedId: { type: Schema.Types.ObjectId },
      createdAt: { type: Date, default: Date.now },
    },
    { _id: false }
  );

const OrgRewardsWalletSchema = new Schema<IOrgRewardsWallet>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    orgId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    balance: { type: Number, required: true, default: 0, min: 0 },
    totalEarnings: { type: Number, required: true, default: 0, min: 0 },
    totalWithdrawn: { type: Number, required: true, default: 0, min: 0 },
    transactions: { type: [OrgRewardsWalletTransactionSchema], default: [] },
  },
  { timestamps: true }
);

// Unique compound — one wallet row per (user, org).
OrgRewardsWalletSchema.index({ userId: 1, orgId: 1 }, { unique: true });
// Admin pages list balances for an org; index for that lookup pattern.
OrgRewardsWalletSchema.index({ orgId: 1, balance: -1 });

export const OrgRewardsWallet = mongoose.model<IOrgRewardsWallet>(
  "OrgRewardsWallet",
  OrgRewardsWalletSchema
);
