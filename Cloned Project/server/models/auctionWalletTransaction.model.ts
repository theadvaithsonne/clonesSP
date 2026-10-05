// src/models/auctionWalletTransaction.model.ts
//
// Append-only audit log for the AuctionWallet. One row per balance change.
//
// `balanceBefore/After` track SPENDABLE balance; `lockedBefore/After` track the
// escrow mirror. Both are recorded on every row so a single transaction shows
// the complete wallet state transition (a bid lock moves money between the two,
// so watching only one number is misleading).
//
// `idempotencyKey` is the guard that makes every money path safely re-runnable:
//   topup       → `topup:<invoiceId>`   (verify-payment AND a gateway webhook can
//                                        both fire fulfillInvoice for one payment)
//   bid lock    → `lock:<bidId>`
//   bid refund  → `refund:<bidId>`
//   bid settle  → `settle:<bidId>`
// Backed by a unique sparse index, same pattern as aivatarWalletTransaction.
//
// ⚠️ CO-OWNED COLLECTION — see the header on auctionWallet.model.ts.

import mongoose, { Schema, Document, Types } from "mongoose";

export const AUCTION_WALLET_TX_TYPES = [
  "topup",
  "bid_lock",
  "bid_refund",
  "bid_settle",
  "adjustment",
] as const;
export type AuctionWalletTxType = (typeof AUCTION_WALLET_TX_TYPES)[number];

export const AUCTION_WALLET_TX_DIRECTIONS = ["in", "out"] as const;
export type AuctionWalletTxDirection =
  (typeof AUCTION_WALLET_TX_DIRECTIONS)[number];

export interface IAuctionWalletTransaction extends Document {
  _id: Types.ObjectId;
  auctionWalletId: Types.ObjectId;
  userId: Types.ObjectId;

  type: AuctionWalletTxType;
  direction: AuctionWalletTxDirection;
  amount: number; // float USD
  currency: string;

  balanceBefore: number;
  balanceAfter: number;
  lockedBefore: number;
  lockedAfter: number;

  productId: Types.ObjectId | null;
  bidId: Types.ObjectId | null;

  description: string;
  note: string | null;
  relatedTransactionId: Types.ObjectId | null; // paired platform-side WalletTransaction
  idempotencyKey: string | null;
  metadata: any;
  status: string;

  createdAt: Date;
  updatedAt: Date;
}

const AuctionWalletTransactionSchema = new Schema<IAuctionWalletTransaction>(
  {
    auctionWalletId: {
      type: Schema.Types.ObjectId,
      ref: "AuctionWallet",
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    type: {
      type: String,
      enum: AUCTION_WALLET_TX_TYPES,
      required: true,
      index: true,
    },
    direction: {
      type: String,
      enum: AUCTION_WALLET_TX_DIRECTIONS,
      required: true,
    },
    // No `min: 0.01` here (unlike CampaignWalletTransaction): a raise whose
    // delta rounds to 0 after currency conversion still deserves an audit row.
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "USD" },

    balanceBefore: { type: Number, required: true },
    balanceAfter: { type: Number, required: true },
    lockedBefore: { type: Number, required: true, default: 0 },
    lockedAfter: { type: Number, required: true, default: 0 },

    // "StoreProduct" (collection `storeproducts`), NOT this backend's own
    // "Product" model — auctions are storefront products owned by
    // garage-store-backend. Getting this ref wrong makes .populate() silently
    // resolve against the wrong collection.
    productId: {
      type: Schema.Types.ObjectId,
      ref: "StoreProduct",
      default: null,
    },
    bidId: { type: Schema.Types.ObjectId, default: null },

    description: { type: String, required: true, trim: true, maxlength: 500 },
    note: { type: String, trim: true, maxlength: 1000, default: null },
    relatedTransactionId: { type: Schema.Types.ObjectId, default: null },
    idempotencyKey: { type: String, default: null },
    metadata: { type: Schema.Types.Mixed },
    status: {
      type: String,
      enum: ["completed", "pending", "failed", "reversed"],
      default: "completed",
      index: true,
    },
  },
  { timestamps: true, collection: "auctionwallettransactions" }
);

AuctionWalletTransactionSchema.index({ auctionWalletId: 1, createdAt: -1 });
AuctionWalletTransactionSchema.index({ userId: 1, createdAt: -1 });
AuctionWalletTransactionSchema.index({ productId: 1, type: 1 });
AuctionWalletTransactionSchema.index(
  { idempotencyKey: 1 },
  { unique: true, sparse: true }
);

export const AuctionWalletTransaction =
  mongoose.model<IAuctionWalletTransaction>(
    "AuctionWalletTransaction",
    AuctionWalletTransactionSchema
  );
