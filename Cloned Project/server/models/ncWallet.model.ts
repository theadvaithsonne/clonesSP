// src/models/ncWallet.model.ts
// Mirror of NetworkChains' Wallet schema. Both backends share the same
// Mongo cluster (same pattern as ContentCampaign / ContentSubmission),
// so Garage opens its own Mongoose handle on NC's `wallets` collection
// and credits affiliates atomically inside the same Mongo transaction
// that debits the CampaignWallet. No HTTP rail, no outbox.
//
// Source of truth: /Users/rehanabbas/network-chains-backend/src/models/wallet.model.ts
// Keep field set + index set in sync with that file.

import mongoose, { Schema, Document, Types } from "mongoose";

export interface INcWalletTransaction {
  type: "credit" | "debit";
  amount: number;        // cents (always positive)
  balanceAfter: number;  // cents
  description: string;
  createdAt: Date;
}

export interface INcWallet extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  balance: number;       // cents
  debt: number;          // cents
  transactions: INcWalletTransaction[];
  createdAt: Date;
  updatedAt: Date;
}

const NcWalletTransactionSchema = new Schema<INcWalletTransaction>(
  {
    type: { type: String, enum: ["credit", "debit"], required: true },
    amount: { type: Number, required: true, min: 0 },
    balanceAfter: { type: Number, required: true },
    description: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const NcWalletSchema = new Schema<INcWallet>(
  {
    // `ref: "User"` is local to this Mongoose handle (it controls `.populate()`
    // resolution; not written to Mongo, doesn't conflict with NC's authoritative
    // schema). Without it, admin endpoints that do `.populate("userId", …)` get
    // a bare ObjectId back and the row's `user` block silently loses email/name.
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    balance: { type: Number, required: true, default: 0, min: 0 },
    debt: { type: Number, required: true, default: 0, min: 0 },
    transactions: { type: [NcWalletTransactionSchema], default: [] },
  },
  { timestamps: true, collection: "wallets" }
);

// Bind to the existing `wallets` collection that NC owns. The model name
// "NcWallet" is local to Garage and never exposed to NC.
export const NcWallet = mongoose.model<INcWallet>("NcWallet", NcWalletSchema);
