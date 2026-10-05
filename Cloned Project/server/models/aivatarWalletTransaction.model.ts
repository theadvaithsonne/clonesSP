import mongoose, { Schema, Document, Types } from "mongoose";

export type AivatarWalletTransactionType = "credit" | "debit" | "clear_debt";
export type AivatarWalletTransactionSource = "user" | "admin" | "system";

export interface IAivatarWalletTransaction extends Document {
  _id: Types.ObjectId;
  walletId: Types.ObjectId;
  orgId: Types.ObjectId;
  type: AivatarWalletTransactionType;
  amount: number;        // cents, always positive
  balanceAfter: number;  // cents
  debtAfter: number;     // cents
  source: AivatarWalletTransactionSource;
  adminEmail?: string;
  description: string;
  note?: string;
  idempotencyKey?: string;
  createdAt: Date;
}

const AivatarWalletTransactionSchema = new Schema<IAivatarWalletTransaction>(
  {
    walletId: { type: Schema.Types.ObjectId, required: true, ref: "AivatarWallet" },
    orgId: { type: Schema.Types.ObjectId, required: true, ref: "Organization" },
    type: {
      type: String,
      enum: ["credit", "debit", "clear_debt"],
      required: true,
    },
    amount: { type: Number, required: true, min: 0 },
    balanceAfter: { type: Number, required: true, min: 0 },
    debtAfter: { type: Number, required: true, min: 0 },
    source: {
      type: String,
      enum: ["user", "admin", "system"],
      required: true,
    },
    adminEmail: { type: String },
    description: { type: String, required: true },
    note: { type: String },
    idempotencyKey: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

AivatarWalletTransactionSchema.index({ orgId: 1, createdAt: -1 });
AivatarWalletTransactionSchema.index({ walletId: 1, createdAt: -1 });
AivatarWalletTransactionSchema.index({ createdAt: -1 });
AivatarWalletTransactionSchema.index({ source: 1, createdAt: -1 });
AivatarWalletTransactionSchema.index({ adminEmail: 1, createdAt: -1 });
AivatarWalletTransactionSchema.index(
  { idempotencyKey: 1 },
  { unique: true, sparse: true }
);

export const AivatarWalletTransaction = mongoose.model<IAivatarWalletTransaction>(
  "AivatarWalletTransaction",
  AivatarWalletTransactionSchema,
  "garage_aivatar_wallet_transactions"
);
