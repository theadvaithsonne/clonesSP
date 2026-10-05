// src/models/auctionSettlement.model.ts
//
// Hand-off queue between the two backends.
//
// `fulfillInvoice` (seller payout, commissions, territory/franchise splits,
// cashback) lives in garagenew and cannot be called from garage-store-backend.
// So when the store backend resolves an auction it does the money movement it
// owns — release the losers' escrow, convert the winner's escrow to "spent" —
// and drops ONE row here. garagenew's settlement cron picks it up and runs the
// normal e-commerce fulfilment pipeline against it.
//
//   store-backend  → INSERT status:"pending"        (only writer of new rows)
//   garagenew cron → UPDATE status:"settled"|"failed" (only consumer)
//
// `bidId` is unique: it is the idempotency anchor for the whole settlement, and
// the same id namespaces the three downstream unique-sparse keys
// (Invoice.razorpayPaymentId, ProductOrder.paymentId, CommissionDistribution
// {paymentId,itemType,itemId}) so a re-run is a no-op at every layer.
//
// ⚠️ CO-OWNED COLLECTION. Mirror lives at
// garage-store-backend/src/models/shared/auctionSettlement.model.ts.

import mongoose, { Schema, Document, Types } from "mongoose";

export const AUCTION_SETTLEMENT_STATUSES = [
  "pending",
  "settled",
  "failed",
  "skipped",
] as const;
export type AuctionSettlementStatus =
  (typeof AUCTION_SETTLEMENT_STATUSES)[number];

// Stop retrying after this many failed attempts so a permanently broken row
// can't loop forever (the old Razorpay capture path retried every 60s with no
// cap or backoff).
export const AUCTION_SETTLEMENT_MAX_ATTEMPTS = 5;

export interface IAuctionSettlement extends Document {
  _id: Types.ObjectId;
  productId: Types.ObjectId;
  orgId: Types.ObjectId;
  bidId: Types.ObjectId;

  winnerUserId: Types.ObjectId;
  winnerEmail: string | null;
  winnerName: string | null;

  amountUsd: number; // exactly what was escrowed — settle this, not a re-conversion
  bidAmount: number;
  bidCurrency: string;
  exchangeRate: number;

  status: AuctionSettlementStatus;
  invoiceId: Types.ObjectId | null;
  productOrderId: Types.ObjectId | null;
  // Proof the seller was actually paid. `settled` is only written once a
  // CommissionDistribution for this sale reaches "completed" — fulfillInvoice
  // returning is NOT sufficient, because it swallows per-line commission
  // errors and still reports success.
  commissionDistributionId: Types.ObjectId | null;
  sellerCreditedUsd: number | null;

  attempts: number;
  lastError: string | null;
  // Exponential backoff. A row is skipped until this time so a broken
  // settlement doesn't burn its whole retry budget in five minutes, before
  // anyone has a chance to fix the underlying data.
  nextAttemptAt: Date | null;
  needsAddress: boolean; // settled without a shipping address; seller must chase
  settledAt: Date | null;

  createdAt: Date;
  updatedAt: Date;
}

const AuctionSettlementSchema = new Schema<IAuctionSettlement>(
  {
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
    bidId: {
      type: Schema.Types.ObjectId,
      required: true,
      unique: true,
    },

    winnerUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    winnerEmail: { type: String, default: null },
    winnerName: { type: String, default: null },

    amountUsd: { type: Number, required: true, min: 0 },
    bidAmount: { type: Number, required: true, min: 0 },
    bidCurrency: { type: String, default: "USD", uppercase: true },
    exchangeRate: { type: Number, default: 1 },

    status: {
      type: String,
      enum: AUCTION_SETTLEMENT_STATUSES,
      default: "pending",
      index: true,
    },
    invoiceId: { type: Schema.Types.ObjectId, ref: "Invoice", default: null },
    productOrderId: {
      type: Schema.Types.ObjectId,
      ref: "ProductOrder",
      default: null,
    },
    commissionDistributionId: {
      type: Schema.Types.ObjectId,
      ref: "CommissionDistribution",
      default: null,
    },
    sellerCreditedUsd: { type: Number, default: null },

    attempts: { type: Number, default: 0, min: 0 },
    lastError: { type: String, default: null },
    nextAttemptAt: { type: Date, default: null },
    needsAddress: { type: Boolean, default: false },
    settledAt: { type: Date, default: null },
  },
  { timestamps: true, collection: "auctionsettlements" }
);

// The cron's hot query.
AuctionSettlementSchema.index({ status: 1, createdAt: 1 });

export const AuctionSettlement = mongoose.model<IAuctionSettlement>(
  "AuctionSettlement",
  AuctionSettlementSchema
);
