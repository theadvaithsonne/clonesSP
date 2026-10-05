import { Schema, model, Document, Types } from "mongoose";

export interface IUnilevelPlusPlan extends Document {
  _id: Types.ObjectId;
  name: string;
  description?: string;
  productPrice: number;
  currency: string;
  gstInclusive: boolean;

  // Pool percentages (must sum to 100%)
  companyPercentage: number;
  directBonusPercentage: number;
  levelBonusPercentage: number;
  infinityTier1Percentage: number;
  infinityTier2Percentage: number;
  managerBonusPercentage: number;

  // Level Bonus configuration
  maxLevels: number;
  pointValue: number;
  legMultipliers: number[];

  // Feature flags for reserved bonuses
  infinityTier1Enabled: boolean;
  infinityTier2Enabled: boolean;
  managerBonusEnabled: boolean;

  // Admin (orgId is legacy/optional — plan is now global)
  orgId?: Types.ObjectId;
  createdBy?: Types.ObjectId;
  isActive: boolean;

  createdAt: Date;
  updatedAt: Date;
}

// Fixed MongoDB ObjectId for the global UP plan
// IMPORTANT: Do NOT change this ID — it is referenced by existing purchases.
export const UNILEVEL_PLUS_PLAN_ID = "6963a0b0a3149ec5949aa940";

// Global Unilevel Plus Plan configuration (like OFFICE_PLANS_CONFIG)
export const UNILEVEL_PLUS_PLAN_CONFIG = {
  _id: UNILEVEL_PLUS_PLAN_ID,
  name: "Unilevel Plus",
  description: "Unlock multi-level affiliate commissions on every referral sale",
  productPrice: 25,
  currency: "USD",
  gstInclusive: true,
  // Pool percentages (must sum to 100% — enforced by the pre-save hook below)
  //
  // Company: $1.00 (4%)   Direct: $9.00 (36%)   Level: $7.20 (28.8%)
  // InfT1:   $1.20 (4.8%) InfT2:  $6.00 (24%)   Manager: $0.60 (2.4%)
  //
  // Rebalanced to push reward toward WIDE builders (infinity tier 2) and away
  // from passive depth (level bonuses). Funded exactly, in max-case terms:
  //
  //   level  3¢→2¢ : 360 pts × $0.01            frees $3.60   (43.2% → 28.8%)
  //   InfT1  $0.60→$0.40 : 3 recipients × $0.20 frees $0.60   (7.2%  → 4.8%)
  //                                             ─────────
  //   InfT2  $1.80 → $6.00 (3 × $2.00)          needs  $4.20  (7.2%  → 24%)
  //
  // 360 pts is a full 15-level chain at the leg-3 multiplier
  // (3 × (1+2+…+15) = 360), i.e. the most the level pool can ever pay.
  //
  // ⚠️ In BUDGET terms this is exactly neutral. In CASH it is not: the level
  // and T1 pools have always been under-consumed (level paid ~$2.90 of
  // $10.80; T1 ~$1.43 of $1.80) while T2 will be fully consumed as more
  // affiliates clear the 10-leg gate. Measured against 305 real sales this
  // moves ~$0.98/sale from platform to affiliates today, trending toward
  // ~$3.77/sale once every sale finds 3 qualifiers in both tiers.
  companyPercentage: 4,
  directBonusPercentage: 36,
  levelBonusPercentage: 28.8,
  infinityTier1Percentage: 4.8,
  infinityTier2Percentage: 24,
  managerBonusPercentage: 2.4,
  maxLevels: 15,
  pointValue: 0.02,
  legMultipliers: [1, 2, 3],
  infinityTier1Enabled: true,
  infinityTier2Enabled: true,
  managerBonusEnabled: true,
  isActive: true,
};

const UnilevelPlusPlanSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    productPrice: {
      type: Number,
      required: true,
      min: 0.01,
    },
    currency: {
      type: String,
      required: true,
      default: "USD",
      trim: true,
    },
    gstInclusive: {
      type: Boolean,
      default: true,
    },

    // Pool percentages
    companyPercentage: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    directBonusPercentage: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    levelBonusPercentage: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    infinityTier1Percentage: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
      default: 0,
    },
    infinityTier2Percentage: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
      default: 0,
    },
    managerBonusPercentage: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
      default: 0,
    },

    // Level Bonus config
    maxLevels: {
      type: Number,
      required: true,
      min: 1,
      max: 20,
      default: 15,
    },
    pointValue: {
      type: Number,
      required: true,
      min: 0.001,
      default: 0.03,
    },
    legMultipliers: {
      type: [Number],
      required: true,
      default: [1, 2, 3],
      validate: {
        validator: function (arr: number[]) {
          return arr && arr.length > 0 && arr.every((n) => n > 0);
        },
        message: "legMultipliers must be a non-empty array of positive numbers",
      },
    },

    // Feature flags
    infinityTier1Enabled: {
      type: Boolean,
      default: false,
    },
    infinityTier2Enabled: {
      type: Boolean,
      default: false,
    },
    managerBonusEnabled: {
      type: Boolean,
      default: false,
    },

    // Admin (orgId is legacy/optional — plan is now global)
    orgId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: false,
      index: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  { timestamps: true }
);

// Only one active plan globally
UnilevelPlusPlanSchema.index(
  { isActive: 1 },
  {
    unique: true,
    partialFilterExpression: { isActive: true },
  }
);

// Pre-save: validate percentages sum to 100%
UnilevelPlusPlanSchema.pre("save", function (next) {
  const total =
    this.companyPercentage +
    this.directBonusPercentage +
    this.levelBonusPercentage +
    this.infinityTier1Percentage +
    this.infinityTier2Percentage +
    this.managerBonusPercentage;

  // Allow small floating point tolerance
  if (Math.abs(total - 100) > 0.01) {
    return next(
      new Error(
        `All pool percentages must sum to 100%. Current total: ${total}%`
      )
    );
  }

  next();
});

export const UnilevelPlusPlan = model<IUnilevelPlusPlan>(
  "UnilevelPlusPlan",
  UnilevelPlusPlanSchema
);
