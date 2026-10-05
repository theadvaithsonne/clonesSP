// src/models/withdrawalPreference.model.ts
//
// How often a user wants a wallet paid out, and how much to leave in it.
//
// A standing instruction, not an automation: nothing here moves money.
// Withdrawals stay admin-initiated (models/withdrawal.model.ts). The admin
// "Preferences" sub-tab on Vaults → Withdrawals reads these to see who is due
// — every Friday for weekly, every day for daily — and how much
// (withdrawable balance minus the keep-amount), and the team pays out from
// there. Founder's spec, 19 Sep 2026.
//
// One document per (user, wallet, org). The absence of a document means the
// default: weekly, keep nothing.
import mongoose, { Schema, Document, Types } from "mongoose";
import { WITHDRAWAL_WALLET_TYPES, type WithdrawalWalletType } from "./withdrawal.model";

export const WITHDRAWAL_FREQUENCIES = ["weekly", "daily"] as const;
export type WithdrawalFrequency = (typeof WITHDRAWAL_FREQUENCIES)[number];
export const DEFAULT_WITHDRAWAL_FREQUENCY: WithdrawalFrequency = "weekly";

export interface IWithdrawalPreference extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  walletType: WithdrawalWalletType;
  /** Store wallets are per org; null for affiliate / content_rewards. */
  orgId: Types.ObjectId | null;
  frequency: WithdrawalFrequency;
  /**
   * Cents to leave in the wallet on each payout; the rest is withdrawn.
   * Only meaningful on weekly (the daily option has no floor). Null = take
   * the whole withdrawable balance.
   */
  keepAmountCents: number | null;
  createdAt: Date;
  updatedAt: Date;
}

const WithdrawalPreferenceSchema = new Schema<IWithdrawalPreference>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    walletType: { type: String, enum: WITHDRAWAL_WALLET_TYPES, required: true },
    orgId: { type: Schema.Types.ObjectId, ref: "Organization", default: null },
    frequency: {
      type: String,
      enum: WITHDRAWAL_FREQUENCIES,
      default: DEFAULT_WITHDRAWAL_FREQUENCY,
      index: true,
    },
    keepAmountCents: { type: Number, default: null, min: 0 },
  },
  { timestamps: true },
);

WithdrawalPreferenceSchema.index({ userId: 1, walletType: 1, orgId: 1 }, { unique: true });

export const WithdrawalPreference = mongoose.model<IWithdrawalPreference>(
  "WithdrawalPreference",
  WithdrawalPreferenceSchema,
);
