// src/models/walletAccount.model.ts
// Per-wallet payout account. A wallet can hold at most one bank account AND
// one crypto address (enforced by the unique index below). Replaces the
// per-user BankDetails model — that data is migrated into affiliate-wallet
// bank accounts (see scripts/migrateBankDetailsToWalletAccount.ts).
//
// Keying by wallet:
//   store           → { userId, orgId }      (one wallet per office)
//   affiliate       → { userId, orgId: null }
//   content_rewards → { userId, orgId: null }

import mongoose, { Schema, Document, Types } from "mongoose";

export const WALLET_ACCOUNT_WALLET_TYPES = [
  "store",
  "affiliate",
  "content_rewards",
] as const;
export type WalletAccountWalletType =
  (typeof WALLET_ACCOUNT_WALLET_TYPES)[number];

export const WALLET_ACCOUNT_TYPES = ["bank", "crypto"] as const;
export type WalletAccountType = (typeof WALLET_ACCOUNT_TYPES)[number];

export const CRYPTO_NETWORKS = [
  "ethereum",
  "tron",
  "bitcoin",
  "solana",
  "bsc",
  "polygon",
] as const;
export type CryptoNetwork = (typeof CRYPTO_NETWORKS)[number];

export interface IWalletAccountAddress {
  line1: string;
  line2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface IWalletAccount extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  walletType: WalletAccountWalletType;
  orgId: Types.ObjectId | null;
  accountType: WalletAccountType;
  label: string;

  // bank fields (accountType === "bank")
  country: string;
  bankName: string;
  branchAddress: IWalletAccountAddress;
  routingNumber: string;
  accountNumber: string;
  swiftCode: string;
  ibanNumber: string;
  beneficiaryName: string;
  beneficiaryAddress: IWalletAccountAddress;

  // crypto fields (accountType === "crypto")
  cryptoNetwork: string;
  cryptoAddress: string;
  cryptoMemo: string;

  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Mirrors the AddressSchema in bank-details.model.ts
const AddressSchema = new Schema<IWalletAccountAddress>(
  {
    line1: { type: String, default: "" },
    line2: { type: String, default: "" },
    city: { type: String, default: "" },
    state: { type: String, default: "" },
    postalCode: { type: String, default: "" },
    country: { type: String, default: "" },
  },
  { _id: false }
);

const WalletAccountSchema = new Schema<IWalletAccount>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    walletType: {
      type: String,
      enum: WALLET_ACCOUNT_WALLET_TYPES,
      required: true,
    },
    // Required for store; null for affiliate/content_rewards.
    orgId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      default: null,
    },
    accountType: {
      type: String,
      enum: WALLET_ACCOUNT_TYPES,
      required: true,
    },
    label: { type: String, default: "", maxlength: 120 },

    // ── Bank ──
    country: { type: String, default: "" },
    bankName: { type: String, default: "" },
    branchAddress: { type: AddressSchema, default: () => ({}) },
    routingNumber: { type: String, default: "" },
    accountNumber: { type: String, default: "" },
    swiftCode: { type: String, default: "" },
    ibanNumber: { type: String, default: "" },
    beneficiaryName: { type: String, default: "" },
    beneficiaryAddress: { type: AddressSchema, default: () => ({}) },

    // ── Crypto ──
    cryptoNetwork: { type: String, default: "" },
    cryptoAddress: { type: String, default: "" },
    cryptoMemo: { type: String, default: "" },

    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// One bank + one crypto per wallet. null orgId is a distinct index value, so
// affiliate/content_rewards each get their own single slot per accountType.
WalletAccountSchema.index(
  { userId: 1, walletType: 1, orgId: 1, accountType: 1 },
  { unique: true, name: "wallet_account_slot_unique" }
);

export const WalletAccount = mongoose.model<IWalletAccount>(
  "WalletAccount",
  WalletAccountSchema
);
