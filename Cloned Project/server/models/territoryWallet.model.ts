import { Schema, model } from "mongoose";

/**
 * Aggregate wallet for territory commissions. One per user — earnings from
 * all entities (country/territory/sub-territory) they own roll up into the
 * same balance. Per-entity attribution lives on TerritoryWalletTransaction.
 *
 * Separate from StoreWallet and AffiliateWallet by design: territory owners
 * are franchise-app users, the cash-out flow is owned by that project, and
 * mixing the balances into the existing wallets would muddy the audit trail.
 */
const TerritoryWalletSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    balance: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    currency: {
      type: String,
      default: "USD",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    totalEarnings: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalWithdrawn: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastTransactionAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

export const TerritoryWallet = model("TerritoryWallet", TerritoryWalletSchema);
