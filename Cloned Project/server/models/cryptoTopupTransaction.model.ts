// Every top-up credit onto a user's crypto-currency StoreWallet gets
// a row here. Distinct from WalletTransaction (which holds general
// wallet ledger entries) so the "top-up history" surface in the FE
// can be queried without wading through refunds, transfers, coupon
// credits, etc.
//
// Write path: `creditUserWalletFromTopup` in the watcher/poller
// stack — after a UserCryptoAddress-matched deposit is detected and
// the user's StoreWallet balance is $inc'd, one of these rows is
// created (idempotently via `metadata.dedupeKey`).
//
// The dedupeKey is `sha256(txHash + address)` — same shape as
// WalletTransaction crypto credits. Prevents a WS-reconciler race
// from double-crediting the same on-chain tx.

import mongoose, { Schema, InferSchemaType, Model } from "mongoose";

const CryptoTopupTransactionSchema = new Schema(
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
    // The StoreWallet that was credited. Denormalised so the FE
    // history endpoint doesn't need to re-derive it.
    walletId: {
      type: Schema.Types.ObjectId,
      ref: "StoreWallet",
      required: true,
      index: true,
    },
    currency: {
      type: String,
      enum: ["BTC", "ETH", "USDT"],
      required: true,
    },
    chain: {
      type: String,
      enum: ["bitcoin", "ethereum", "polygon", "bsc", "tron"],
      required: true,
    },
    coin: {
      type: String,
      enum: ["BTC", "ETH", "USDT"],
      required: true,
    },
    address: { type: String, required: true, index: true },
    amountAtomic: { type: String, required: true },
    amount: { type: Number, required: true },
    // Snapshot of the USD equivalent at credit time. Purely display —
    // not used for accounting. Stored so the FE can show "you
    // received 0.01 BTC (≈ $960 at deposit)" without re-fetching the
    // FX rate on every render.
    amountUsdAtDeposit: { type: Number, default: 0 },
    txHash: { type: String, required: true, index: true },
    fromAddress: { type: String, default: "" },
    blockNumber: { type: Number, default: 0 },
    receivedAt: { type: Date, required: true, default: () => new Date() },
    status: {
      type: String,
      enum: ["credited", "failed"],
      default: "credited",
      index: true,
    },
    failureReason: { type: String, default: "" },
    metadata: {
      // sha256(txHash + address). Partial-unique index below kills
      // double-credit races. Same shape as WalletTransaction's dedupe.
      dedupeKey: { type: String, required: true },
    },
  },
  { timestamps: true },
);

// Partial-unique on dedupeKey — matches the WalletTransaction pattern.
// Deposits that duplicate an existing (txHash, address) pair E11000 on
// insert; the caller catches and treats as already-credited.
CryptoTopupTransactionSchema.index(
  { "metadata.dedupeKey": 1 },
  {
    unique: true,
    partialFilterExpression: { "metadata.dedupeKey": { $exists: true } },
  },
);

// User history queries — newest first, filterable per wallet.
CryptoTopupTransactionSchema.index({ userId: 1, orgId: 1, receivedAt: -1 });
CryptoTopupTransactionSchema.index({ walletId: 1, receivedAt: -1 });

export type ICryptoTopupTransaction = InferSchemaType<
  typeof CryptoTopupTransactionSchema
>;

export const CryptoTopupTransaction: Model<ICryptoTopupTransaction> =
  (mongoose.models
    .CryptoTopupTransaction as Model<ICryptoTopupTransaction>) ||
  mongoose.model<ICryptoTopupTransaction>(
    "CryptoTopupTransaction",
    CryptoTopupTransactionSchema,
  );
