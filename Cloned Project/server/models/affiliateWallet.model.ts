import { Schema, model } from "mongoose";

const AffiliateWalletSchema = new Schema(
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
    // Lifetime earnings tracking
    totalEarnings: {
      type: Number,
      default: 0,
      min: 0,
    },
    // For future withdrawal tracking
    totalWithdrawn: {
      type: Number,
      default: 0,
      min: 0,
    },
    /**
     * Lifetime commission credited to this wallet and then taken back out —
     * no licence, no NetworkChain subscription, or cascaded to an upline.
     * See services/commissionForfeiture.ts.
     *
     * `totalEarnings` stays GROSS, so net kept = totalEarnings - totalForfeited.
     * Absent on every wallet written before this shipped, hence the default:
     * read it as `(w.totalForfeited || 0)`.
     */
    totalForfeited: {
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

export const AffiliateWallet = model("AffiliateWallet", AffiliateWalletSchema);
