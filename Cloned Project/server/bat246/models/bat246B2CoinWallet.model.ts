import { Schema, model, Types } from "mongoose";

/**
 * B2 Coins — a new, not-yet-redeemable currency (spending them on the
 * $650/$160 entry products at checkout is explicit future work). One doc
 * per RECIPIENT — the running balance they can eventually spend.
 *
 * Modeled on storeWallet.model.ts's shape, but deliberately its own
 * collection: B2 Coins are not USD and must never be summed/confused with
 * a real StoreWallet balance.
 *
 * The GIVER side has no running-total field here on purpose — how much
 * any one person has given (overall, and per eligibility pool) is always
 * computed by aggregating bat246B2CoinTransaction.model.ts at check time,
 * not tracked as a second, separately-maintained number. See that model's
 * header comment for why.
 */
const Bat246B2CoinWalletSchema = new Schema(
  {
    userId: { type: Types.ObjectId, ref: "User", required: true, unique: true, index: true },
    balance: { type: Number, default: 0, min: 0 },
    lastTransactionAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export const Bat246B2CoinWallet = model("bat246B2CoinWallets", Bat246B2CoinWalletSchema);
