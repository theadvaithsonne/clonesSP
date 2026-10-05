// src/models/auctionEscrow.model.ts
//
// One row per (bidder, auction) recording how much of that bidder's money is
// currently held in escrow for that auction. This is what makes DELTA LOCKING
// correct: raising a bid from $100 to $110 must move $10, not $110.
//
//   lockForBid()  → delta = requiredUsd - lockedUsd, then lockedUsd += delta
//   releaseEscrow() → refunds lockedUsd, status = "refunded"
//   markEscrowSettled() → the winner's escrow converts to a sale, status = "settled"
//
// `exchangeRate` is pinned at lock time and reused at settlement, so FX drift
// between the bid and the auction close can never unbalance the ledger — we
// settle the exact USD that was escrowed.
//
// ⚠️ CO-OWNED COLLECTION. garage-store-backend is the only writer (all three
// operations above happen inside its bid/resolution transactions); garagenew
// reads it during settlement. Mirror lives at
// garage-store-backend/src/models/shared/auctionEscrow.model.ts.

import mongoose, { Schema, Document, Types } from "mongoose";

export const AUCTION_ESCROW_STATUSES = ["held", "refunded", "settled"] as const;
export type AuctionEscrowStatus = (typeof AUCTION_ESCROW_STATUSES)[number];

export interface IAuctionEscrow extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  productId: Types.ObjectId;
  orgId: Types.ObjectId;

  lockedUsd: number; // running total this bidder has escrowed on this auction
  bidAmount: number; // latest bid, in the auction's own currency
  bidCurrency: string;
  exchangeRate: number; // bidCurrency → USD, pinned at first lock

  status: AuctionEscrowStatus;
  lastBidId: Types.ObjectId | null;
  refundedAt: Date | null;
  settledAt: Date | null;

  createdAt: Date;
  updatedAt: Date;
}

const AuctionEscrowSchema = new Schema<IAuctionEscrow>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    // "StoreProduct" (collection `storeproducts`), NOT this backend's own
    // "Product" model — those are different collections.
    productId: {
      type: Schema.Types.ObjectId,
      ref: "StoreProduct",
      required: true,
      index: true,
    },
    orgId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },

    lockedUsd: { type: Number, required: true, default: 0, min: 0 },
    bidAmount: { type: Number, required: true, default: 0, min: 0 },
    bidCurrency: { type: String, default: "USD", uppercase: true },
    exchangeRate: { type: Number, default: 1 },

    status: {
      type: String,
      enum: AUCTION_ESCROW_STATUSES,
      default: "held",
      index: true,
    },
    lastBidId: { type: Schema.Types.ObjectId, default: null },
    refundedAt: { type: Date, default: null },
    settledAt: { type: Date, default: null },
  },
  { timestamps: true, collection: "auctionescrows" }
);

// One escrow row per bidder per auction — the delta calculation depends on it.
AuctionEscrowSchema.index({ userId: 1, productId: 1 }, { unique: true });
// Resolution sweeps every held escrow on an auction to refund the losers.
AuctionEscrowSchema.index({ productId: 1, status: 1 });

export const AuctionEscrow = mongoose.model<IAuctionEscrow>(
  "AuctionEscrow",
  AuctionEscrowSchema
);
