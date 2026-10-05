// src/models/withdrawal.model.ts
// Admin-initiated withdrawal. Canonical source of truth for the withdrawal
// lifecycle (status, fee, receipt) — we do NOT rely on native wallet ledger
// rows because NcWallet (content_rewards) has no per-transaction status.
//
// Money is in CENTS (consistent with campaign/content-rewards). The wallet
// balance is debited on initiate, refunded on reject, kept on complete. The
// 5% fee is credited to the platform (Shorupan) StoreWallet on completion.

import mongoose, { Schema, Document, Types } from "mongoose";

export const WITHDRAWAL_WALLET_TYPES = [
  "store",
  "affiliate",
  "content_rewards",
] as const;
export type WithdrawalWalletType = (typeof WITHDRAWAL_WALLET_TYPES)[number];

export const WITHDRAWAL_STATUSES = ["initiated", "completed", "rejected"] as const;
export type WithdrawalStatus = (typeof WITHDRAWAL_STATUSES)[number];

export const WITHDRAWAL_TYPES = ["manual"] as const;
export type WithdrawalType = (typeof WITHDRAWAL_TYPES)[number];

export const TAX_TYPES = ["percent", "flat"] as const;
export type TaxType = (typeof TAX_TYPES)[number];

export interface IWithdrawalTax {
  label: string;
  type: TaxType;
  value: number;  // percent value (e.g. 10) OR flat cents
  amount: number; // computed cents
}

export interface IWithdrawal extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  walletType: WithdrawalWalletType;
  orgId: Types.ObjectId | null;
  accountId: Types.ObjectId;
  accountType: "bank" | "crypto";
  accountSnapshot: any;

  withdrawalType: WithdrawalType;
  currency: string;

  grossAmount: number; // cents — total debited
  feePercent: number;  // e.g. 5
  feeAmount: number;   // cents — round(gross * fee%)
  /** Bank's own transfer charge, cents. Deducted but never ours. 0 for crypto. */
  bankTransferFee: number;
  /** Why feePercent is what it is. Affiliate wallet only. */
  feeTier?: {
    frequency?: string;
    keepAmountCents?: number;
    meetsKeepThreshold?: boolean;
    configured?: boolean;
    payoutMethod?: string;
  };
  taxes: IWithdrawalTax[]; // admin-added deduction lines
  taxTotal: number;    // cents — Σ taxes[].amount
  netAmount: number;   // cents — gross - fee - taxTotal

  status: WithdrawalStatus;
  initiatedByAdmin: Types.ObjectId;
  /** Present only when a super admin departed from the rules — see schema. */
  adminOverride?: {
    tierFeePercent?: number;
    appliedFeePercent?: number;
    gatedCapCents?: number;
    walletBalanceCents?: number;
    releasedCents?: number;
    lockedByMaturityCents?: number;
    lockedByLicenceCents?: number;
    reason?: string;
    at?: Date;
  };
  processedByAdmin: Types.ObjectId | null;
  processedAt: Date | null;
  /**
   * First proof attached, kept for every row written before `proofs` existed
   * and still populated alongside it so old readers keep working.
   */
  receiptUrl: string;
  /**
   * The raw on-chain transaction hash, when the payout went out in crypto.
   *
   * Stored separately from `receiptUrl` because that field holds an explorer
   * URL built FROM the hash — the hash itself used to be thrown away, so the
   * member could follow a link but never copy the hash into a wallet or a
   * support ticket.
   */
  txHash: string;
  /**
   * Everything the admin attached while approving: bank screenshots, transfer
   * confirmations, a UTR slip, anything. One payout often needs more than one
   * document, and before this only a single URL survived.
   */
  proofs: { url: string; label: string; uploadedAt: Date }[];
  rejectionReason: string;
  feeTransactionRef: string;

  createdAt: Date;
  updatedAt: Date;
}

const WithdrawalTaxSchema = new Schema<IWithdrawalTax>(
  {
    label: { type: String, required: true, trim: true, maxlength: 60 },
    type: { type: String, enum: TAX_TYPES, required: true },
    value: { type: Number, required: true, min: 0 },
    amount: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const WithdrawalSchema = new Schema<IWithdrawal>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    walletType: { type: String, enum: WITHDRAWAL_WALLET_TYPES, required: true },
    orgId: { type: Schema.Types.ObjectId, ref: "Organization", default: null },
    accountId: { type: Schema.Types.ObjectId, ref: "WalletAccount", required: true },
    accountType: { type: String, enum: ["bank", "crypto"], required: true },
    accountSnapshot: { type: Schema.Types.Mixed },

    withdrawalType: { type: String, enum: WITHDRAWAL_TYPES, default: "manual" },
    currency: { type: String, default: "USD" },

    grossAmount: { type: Number, required: true, min: 1 },
    feePercent: { type: Number, required: true, default: 5 },
    feeAmount: { type: Number, required: true, min: 0 },
    /**
     * What the BANK charges to move the money, in cents. Deducted from the
     * payout like a tax, but never credited to the platform wallet — it is
     * the bank's money, not ours. Always 0 for crypto payouts.
     */
    bankTransferFee: { type: Number, default: 0, min: 0 },
    /**
     * Why `feePercent` is what it is, snapshotted at initiate time so a later
     * preference change never rewrites history. Affiliate wallet only.
     */
    feeTier: {
      frequency: { type: String },
      keepAmountCents: { type: Number },
      meetsKeepThreshold: { type: Boolean },
      configured: { type: Boolean },
      payoutMethod: { type: String },
    },
    taxes: { type: [WithdrawalTaxSchema], default: [] },
    taxTotal: { type: Number, required: true, default: 0, min: 0 },
    netAmount: { type: Number, required: true, min: 0 },

    status: {
      type: String,
      enum: WITHDRAWAL_STATUSES,
      default: "initiated",
      index: true,
    },
    initiatedByAdmin: { type: Schema.Types.ObjectId, ref: "GarageAdmin", required: true },

    /**
     * Set only when a super admin departed from the rules at initiate time:
     * charged a different fee, released locked funds, or both.
     *
     * Kept as a snapshot rather than recomputed, because the point of the
     * record is what the rules said AT THE TIME versus what was actually
     * done. `gatedCapCents` is what the member could normally have taken;
     * `releasedCents` is how much beyond that was paid out.
     */
    adminOverride: {
      type: new Schema(
        {
          tierFeePercent: { type: Number },
          appliedFeePercent: { type: Number },
          gatedCapCents: { type: Number },
          walletBalanceCents: { type: Number },
          releasedCents: { type: Number },
          lockedByMaturityCents: { type: Number },
          lockedByLicenceCents: { type: Number },
          reason: { type: String, trim: true, maxlength: 500 },
          at: { type: Date },
        },
        { _id: false }
      ),
      required: false,
    },
    processedByAdmin: { type: Schema.Types.ObjectId, ref: "GarageAdmin", default: null },
    processedAt: { type: Date, default: null },
    receiptUrl: { type: String, default: "" },
    txHash: { type: String, default: "", trim: true, maxlength: 200 },
    proofs: {
      type: [
        new Schema(
          {
            url: { type: String, required: true, trim: true },
            // Shown to the member in the completion email, so it has to read
            // like something a person wrote: "Bank transfer screenshot".
            label: { type: String, default: "", trim: true, maxlength: 120 },
            uploadedAt: { type: Date, default: Date.now },
          },
          { _id: false }
        ),
      ],
      default: [],
    },
    rejectionReason: { type: String, default: "", maxlength: 1000 },
    feeTransactionRef: { type: String, default: "" },
  },
  { timestamps: true }
);

// Admin queue (filter by status, newest first)
WithdrawalSchema.index({ status: 1, createdAt: -1 });
// User's withdrawals for a wallet (for the client-side transaction merge)
WithdrawalSchema.index({ userId: 1, walletType: 1, orgId: 1, createdAt: -1 });

export const Withdrawal = mongoose.model<IWithdrawal>("Withdrawal", WithdrawalSchema);
