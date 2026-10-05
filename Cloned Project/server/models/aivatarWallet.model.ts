import mongoose, { Schema, Document, Types } from "mongoose";

export interface IAivatarWallet extends Document {
  _id: Types.ObjectId;
  orgId: Types.ObjectId;
  balance: number;            // cents
  debt: number;               // cents
  lastTransactionAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const AivatarWalletSchema = new Schema<IAivatarWallet>(
  {
    orgId: { type: Schema.Types.ObjectId, required: true, unique: true, index: true },
    balance: { type: Number, required: true, default: 0, min: 0 },
    debt: { type: Number, required: true, default: 0, min: 0 },
    lastTransactionAt: { type: Date },
  },
  { timestamps: true }
);

export const AivatarWallet = mongoose.model<IAivatarWallet>(
  "AivatarWallet",
  AivatarWalletSchema,
  "garage_aivatar_wallets"
);
