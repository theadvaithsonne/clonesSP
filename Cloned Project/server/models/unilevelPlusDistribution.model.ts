import { Schema, model, Document, Types } from "mongoose";

export interface IUPLevelBonusRecipient {
  userId: Types.ObjectId;
  level: number;
  legNumber: number;
  legMultiplier: number;
  points: number;
  /**
   * What the PLAN allocated. Kept as the plan figure so the comp maths stays
   * auditable; `creditedAmount` is what actually reached the wallet.
   */
  amount: number;
  /**
   * What actually reached this recipient's wallet.
   *
   * Differs from `amount` only when the NetworkChain coverage split fired
   * (services/networkChainCoverage.ts): an earner without live coverage keeps
   * half and the rest is forwarded up the chain. Absent on rows written before
   * the split existed — readers must fall back to `amount`.
   */
  creditedAmount?: number;
  /** The half forwarded away, if any. */
  forfeitedAmount?: number;
  /** Who received the forfeited half. Absent means the platform did. */
  forfeitedToUserId?: Types.ObjectId;
  directChildId: Types.ObjectId;
  walletId?: Types.ObjectId;
  transactionId?: Types.ObjectId;
}

export interface IUPInfinityBonusRecipient {
  userId: Types.ObjectId;
  tier: 1 | 2;
  /**
   * What the PLAN allocated. Kept as the plan figure so the comp maths stays
   * auditable; `creditedAmount` is what actually reached the wallet.
   */
  amount: number;
  /**
   * What actually reached this recipient's wallet.
   *
   * Differs from `amount` only when the NetworkChain coverage split fired
   * (services/networkChainCoverage.ts): an earner without live coverage keeps
   * half and the rest is forwarded up the chain. Absent on rows written before
   * the split existed — readers must fall back to `amount`.
   */
  creditedAmount?: number;
  /** The half forwarded away, if any. */
  forfeitedAmount?: number;
  /** Who received the forfeited half. Absent means the platform did. */
  forfeitedToUserId?: Types.ObjectId;
  directReferralCount: number;
  walletId?: Types.ObjectId;
  transactionId?: Types.ObjectId;
}

export interface IUnilevelPlusDistribution extends Document {
  _id: Types.ObjectId;
  planId: Types.ObjectId;
  buyerId: Types.ObjectId;
  saleAmount: number;
  currency: string;
  paymentId?: string;

  // Breakdown
  companyAmount: number;
  directBonusAmount: number;
  directBonusRecipientId?: Types.ObjectId;
  /** Actually credited to the direct referrer; see IUPLevelBonusRecipient. */
  directBonusCreditedAmount?: number;
  directBonusForfeitedAmount?: number;
  directBonusForfeitedToUserId?: Types.ObjectId;

  levelBonusBudget: number;
  levelBonusDistributed: number;
  levelBonusRecipients: IUPLevelBonusRecipient[];

  // Reserved pools
  infinityTier1Amount: number;
  infinityTier1Recipients: IUPInfinityBonusRecipient[];
  infinityTier1Distributed: number;
  infinityTier2Amount: number;
  infinityTier2Recipients: IUPInfinityBonusRecipient[];
  infinityTier2Distributed: number;
  managerBonusAmount: number;
  unallocatedAmount: number;

  status: "pending" | "completed" | "failed" | "reversed";
  failureReason?: string;
  metadata?: Record<string, any>;

  createdAt: Date;
  updatedAt: Date;
}

const UPLevelBonusRecipientSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    level: {
      type: Number,
      required: true,
      min: 1,
    },
    legNumber: {
      type: Number,
      required: true,
      min: 1,
    },
    legMultiplier: {
      type: Number,
      required: true,
      min: 1,
    },
    points: {
      type: Number,
      required: true,
      min: 0,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    /** Actually credited; absent on pre-split rows (fall back to `amount`). */
    creditedAmount: { type: Number },
    /** The half forwarded up the chain by the NetworkChain coverage split. */
    forfeitedAmount: { type: Number },
    /** Recipient of the forfeited half; absent means the platform took it. */
    forfeitedToUserId: { type: Schema.Types.ObjectId, ref: "User" },
    directChildId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    walletId: {
      type: Schema.Types.ObjectId,
      ref: "AffiliateWallet",
    },
    transactionId: {
      type: Schema.Types.ObjectId,
      ref: "WalletTransaction",
    },
  },
  { _id: false }
);

const UPInfinityBonusRecipientSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    tier: {
      type: Number,
      enum: [1, 2],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    /** Actually credited; absent on pre-split rows (fall back to `amount`). */
    creditedAmount: { type: Number },
    /** The half forwarded up the chain by the NetworkChain coverage split. */
    forfeitedAmount: { type: Number },
    /** Recipient of the forfeited half; absent means the platform took it. */
    forfeitedToUserId: { type: Schema.Types.ObjectId, ref: "User" },
    directReferralCount: {
      type: Number,
      required: true,
      min: 0,
    },
    walletId: {
      type: Schema.Types.ObjectId,
      ref: "AffiliateWallet",
    },
    transactionId: {
      type: Schema.Types.ObjectId,
      ref: "WalletTransaction",
    },
  },
  { _id: false }
);

const UnilevelPlusDistributionSchema = new Schema(
  {
    planId: {
      type: Schema.Types.ObjectId,
      ref: "UnilevelPlusPlan",
      required: true,
      index: true,
    },
    buyerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    saleAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: "USD",
    },
    paymentId: {
      type: String,
      index: true,
    },

    // Breakdown
    companyAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    directBonusAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    directBonusRecipientId: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    /** Actually credited; absent on pre-split rows (fall back to the plan amount). */
    directBonusCreditedAmount: { type: Number },
    directBonusForfeitedAmount: { type: Number },
    directBonusForfeitedToUserId: { type: Schema.Types.ObjectId, ref: "User" },

    levelBonusBudget: {
      type: Number,
      required: true,
      min: 0,
    },
    levelBonusDistributed: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    levelBonusRecipients: {
      type: [UPLevelBonusRecipientSchema],
      default: [],
    },

    // Reserved pools
    infinityTier1Amount: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    infinityTier1Recipients: {
      type: [UPInfinityBonusRecipientSchema],
      default: [],
    },
    infinityTier1Distributed: {
      type: Number,
      default: 0,
      min: 0,
    },
    infinityTier2Amount: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    infinityTier2Recipients: {
      type: [UPInfinityBonusRecipientSchema],
      default: [],
    },
    infinityTier2Distributed: {
      type: Number,
      default: 0,
      min: 0,
    },
    managerBonusAmount: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    unallocatedAmount: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },

    status: {
      type: String,
      enum: ["pending", "completed", "failed", "reversed"],
      default: "pending",
      index: true,
    },
    failureReason: {
      type: String,
      trim: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
    },
  },
  { timestamps: true }
);

// Indexes
UnilevelPlusDistributionSchema.index({ buyerId: 1, createdAt: -1 });
UnilevelPlusDistributionSchema.index({
  directBonusRecipientId: 1,
  createdAt: -1,
});
UnilevelPlusDistributionSchema.index({
  "levelBonusRecipients.userId": 1,
  createdAt: -1,
});
UnilevelPlusDistributionSchema.index({ planId: 1, status: 1 });
UnilevelPlusDistributionSchema.index({
  "infinityTier1Recipients.userId": 1,
  createdAt: -1,
});
UnilevelPlusDistributionSchema.index({
  "infinityTier2Recipients.userId": 1,
  createdAt: -1,
});

// Unique index to prevent duplicate distributions for same payment
UnilevelPlusDistributionSchema.index(
  { paymentId: 1 },
  { unique: true, sparse: true }
);

export const UnilevelPlusDistribution = model<IUnilevelPlusDistribution>(
  "UnilevelPlusDistribution",
  UnilevelPlusDistributionSchema
);
