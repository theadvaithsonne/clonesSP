// src/models/auctionWallet.model.ts
//
// Prepaid wallet a buyer funds before bidding on storefront auctions.
// Replaces the old Razorpay card auth-and-capture bid path entirely.
//
// Money model:
//   topup     — invoice paid  → `balance` += amount        (garagenew, fulfillInvoice)
//   bid lock  — bid placed    → `balance` -= d, `lockedBalance` += d, and the
//                               same `d` is credited to the platform StoreWallet
//                               (the escrow account). See services/auctionEscrow
//                               in garage-store-backend.
//   outbid    — refund        → `lockedBalance` -= L, `balance` += L
//   win       — settle        → `lockedBalance` -= L (the money already left
//                               `balance` at lock time and is sitting in escrow)
//
// So `balance` is spendable and `lockedBalance` is a DISPLAY MIRROR of what is
// currently held in escrow on this user's behalf — the funds themselves are not
// in this document once locked.
//
// Unlike StoreWallet (keyed per user+org) this wallet is GLOBAL PER USER: a
// bidder bids across many sellers' stores out of one balance.
//
// Balances are float USD main units (e.g. 12.34), matching StoreWallet /
// AffiliateWallet / CampaignWallet. Round every write through `round2`.
//
// ⚠️ CO-OWNED COLLECTION. garage-store-backend writes this collection too (bid
// lock / refund / settle) via src/models/shared/auctionWallet.model.ts. Keep the
// two schemas in sync.

import mongoose, { Schema, Document, Types } from "mongoose";

export interface IAuctionWallet extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;

  balance: number; // spendable USD
  lockedBalance: number; // escrowed USD (display mirror)
  currency: string;
  isActive: boolean;
  lastTransactionAt: Date | null;

  totalToppedUp: number;
  totalLocked: number;
  totalRefunded: number;
  totalSpent: number;

  createdAt: Date;
  updatedAt: Date;
}

const AuctionWalletSchema = new Schema<IAuctionWallet>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    balance: { type: Number, required: true, default: 0, min: 0 },
    lockedBalance: { type: Number, required: true, default: 0, min: 0 },
    currency: { type: String, default: "USD" },
    isActive: { type: Boolean, default: true },
    lastTransactionAt: { type: Date, default: null },

    // Lifetime aggregates — cheap dashboard reads without scanning the ledger.
    totalToppedUp: { type: Number, default: 0, min: 0 },
    totalLocked: { type: Number, default: 0, min: 0 },
    totalRefunded: { type: Number, default: 0, min: 0 },
    totalSpent: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true, collection: "auctionwallets" }
);

export const AuctionWallet = mongoose.model<IAuctionWallet>(
  "AuctionWallet",
  AuctionWalletSchema
);
