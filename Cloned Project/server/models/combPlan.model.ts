import { Schema, model, Document, Types } from "mongoose";

export interface ICombPlanLevel {
  level: number;
  percentage: number;
  description?: string;
}

/**
 * How the plan caps commission distributions:
 *   - "perpetual" — every purchase pays commission every time (the
 *      historical behaviour, and the DEFAULT for every plan created
 *      before this field existed).
 *   - "per_pair_capped" — each affiliate earns commission on at most
 *      `capCount` distributions per unique customer under this plan.
 *      When a specific affiliate's counter hits the cap on a later
 *      purchase, THEIR share is dropped (silently routed to platform);
 *      other levels in the same distribution are unaffected.
 */
export type CombPlanCapType = "perpetual" | "per_pair_capped";

/**
 * Which comp engine this plan drives.
 *
 *   "levels"        — the historical behaviour: fixed L1/L2/L3… percentages
 *                     off the sale principal, paid to the referral chain.
 *   "unilevel_plus" — a single percentage of the principal is handed to the
 *                     Unilevel Plus tree (services/unilevelPlusCommission.ts)
 *                     and distributed by ITS rules: 36% direct, a 15-level
 *                     point budget, infinity tiers, etc.
 *
 * The two are mutually exclusive on a given item. Absent on every plan created
 * before this field existed, which is why "levels" is the default — those docs
 * must keep behaving exactly as they always have.
 */
export type CombPlanKind = "levels" | "unilevel_plus";

export interface ICombPlan extends Document {
  _id: Types.ObjectId;
  name: string;
  description?: string;
  itemType:
    | "course"
    | "product"
    | "channel"
    | "workshop"
    | "service"
    | "call"
    | "event"
    // HiFi bond instrument. `itemId` is the BondInstrument. Lets a
    // founder attach either a `levels` or a `unilevel_plus` plan to a
    // bond; the bond engine computes a commission POOL and hands it to
    // the comp-plan service, never splitting it itself (spec §6).
    | "bond";
  itemId: Types.ObjectId;
  orgId: Types.ObjectId;
  createdBy: Types.ObjectId;
  levels: ICombPlanLevel[];
  totalPercentage: number;
  platformPercentage: number;
  isActive: boolean;
  /** Defaults to "perpetual" — existing docs without the field read as
   *  "perpetual" and skip the cap query entirely, so pre-existing plans
   *  keep behaving exactly as they did. */
  capType?: CombPlanCapType;
  /** Only meaningful when capType === "per_pair_capped". Range 1..100. */
  capCount?: number;
  /** Defaults to "levels" — see CombPlanKind. */
  planKind?: CombPlanKind;
  /**
   * Share of the sale principal routed into the Unilevel Plus tree. Only
   * meaningful when planKind === "unilevel_plus". Whatever the tree does not
   * pay out is returned to the SELLER, not swept to the platform — so this is
   * a ceiling on what the founder gives up, not a fee.
   */
  unilevelPlusPercentage?: number;
  createdAt: Date;
  updatedAt: Date;
}

const CombPlanLevelSchema = new Schema(
  {
    level: {
      type: Number,
      required: true,
      min: 1,
      max: 10,
    },
    percentage: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 100,
    },
  },
  { _id: false }
);

const CombPlanSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    itemType: {
      type: String,
      // "bond" added for HiFi bonds — must be in this runtime array as
      // well as the TS union above, or every bond comb-plan save fails
      // validation (Mongoose does not read the type).
      enum: ["course", "product", "channel", "workshop", "service", "call", "event", "bond"],
      required: true,
      index: true,
    },
    itemId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    orgId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    levels: {
      type: [CombPlanLevelSchema],
      required: true,
      validate: {
        validator: function (levels: ICombPlanLevel[]) {
          // Must have at least one level
          if (!levels || levels.length === 0) return true; // Allow empty (no commissions)

          // Check for duplicate levels
          const levelNumbers = levels.map((l) => l.level);
          const uniqueLevels = new Set(levelNumbers);
          if (uniqueLevels.size !== levelNumbers.length) return false;

          // Check levels are sequential starting from 1
          const sorted = [...levelNumbers].sort((a, b) => a - b);
          for (let i = 0; i < sorted.length; i++) {
            if (sorted[i] !== i + 1) return false;
          }

          return true;
        },
        message: "Levels must be unique and sequential starting from 1",
      },
    },
    totalPercentage: {
      type: Number,
      required: true,
      min: 0,
      // Max 90% — leaves 5% for the platform AND a 5% seller floor. The
      // runtime distribution layer (services/commission.ts COMB_PLAN_MAX_PERCENTAGE)
      // enforces the same cap; keep these two in sync.
      max: 90,
      default: 0,
    },
    platformPercentage: {
      type: Number,
      required: true,
      min: 5, // Platform always gets at least 5%
      max: 100,
      default: 5,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    // Which comp engine drives this plan — see CombPlanKind. Optional so
    // every pre-existing document reads as "levels" without a migration.
    planKind: {
      type: String,
      enum: ["levels", "unilevel_plus"],
      default: "levels",
      index: true,
    },
    // Share of the sale principal handed to the Unilevel Plus tree. Capped at
    // the same 90% as `totalPercentage` — the two are alternative routes to
    // the same money, so they share a ceiling. Unspent pools return to the
    // seller (see services/commission.ts), which is why this is a ceiling on
    // the founder's give-up rather than a guaranteed cost.
    unilevelPlusPercentage: {
      type: Number,
      min: 0,
      max: 90,
    },
    // Distribution cap — see CombPlanCapType docs. Optional so every
    // pre-existing document behaves as "perpetual" without a migration.
    // `capCount` is validated conditionally in the pre-save hook below.
    capType: {
      type: String,
      enum: ["perpetual", "per_pair_capped"],
      default: "perpetual",
    },
    capCount: {
      type: Number,
      min: 1,
      max: 100,
    },
  },
  { timestamps: true }
);

// Compound index: Only one active comb plan per item
CombPlanSchema.index(
  { itemType: 1, itemId: 1, isActive: 1 },
  {
    unique: true,
    partialFilterExpression: { isActive: true },
  }
);

// Index for querying by org
CombPlanSchema.index({ orgId: 1, itemType: 1, isActive: 1 });

// Pre-save hook to calculate totals
CombPlanSchema.pre("save", function (next) {
  // ── planKind is exclusive ──
  // A plan drives EITHER fixed levels OR the Unilevel Plus tree. Allowing
  // both would pay the same uplines twice out of one sale and make the 90%
  // ceiling meaningless, since the two are enforced separately below.
  const kind = (this as any).planKind || "levels";
  if (kind === "unilevel_plus") {
    if (this.levels && this.levels.length > 0) {
      return next(
        new Error(
          'A "unilevel_plus" plan cannot also define levels — the two comp engines are mutually exclusive'
        )
      );
    }
    const pct = (this as any).unilevelPlusPercentage;
    if (typeof pct !== "number" || pct <= 0) {
      return next(
        new Error('A "unilevel_plus" plan requires unilevelPlusPercentage > 0')
      );
    }
    // Same ceiling as level plans: 5% platform + 90% commissions + 5% seller
    // floor. The distributor applies the identical cap at runtime.
    if (pct > 90) {
      return next(
        new Error(
          "unilevelPlusPercentage cannot exceed 90% (5% platform + 5% seller floor reserved)"
        )
      );
    }
    this.totalPercentage = 0;
    this.platformPercentage = 5;
    return next();
  }

  // A levels plan must not carry a stray UP percentage — otherwise flipping
  // planKind back and forth silently re-arms an old value.
  (this as any).unilevelPlusPercentage = undefined;

  if (this.levels && this.levels.length > 0) {
    this.totalPercentage = this.levels.reduce(
      (sum, level) => sum + level.percentage,
      0
    );
  } else {
    this.totalPercentage = 0;
  }

  // Platform gets 5% fixed, remaining is split between seller and referrers
  this.platformPercentage = 5;

  // Validate total doesn't exceed 90% — the runtime distributor refuses
  // anything above this so the seller never goes below their 5% floor
  // (5% platform + 90% commissions + 5% seller = 100%).
  if (this.totalPercentage > 90) {
    return next(
      new Error(
        "Total commission percentage cannot exceed 90% (5% platform + 5% seller floor reserved)"
      )
    );
  }

  // Cap-type consistency:
  //   - "per_pair_capped" REQUIRES capCount ≥ 1
  //   - "perpetual" (or missing) drops any stray capCount so the doc
  //      stays clean
  if (this.capType === "per_pair_capped") {
    if (typeof this.capCount !== "number" || this.capCount < 1) {
      return next(
        new Error(
          "capCount is required and must be ≥ 1 when capType is 'per_pair_capped'"
        )
      );
    }
  } else {
    // Coerce anything non-per_pair_capped to a clean perpetual doc.
    this.capType = "perpetual";
    this.capCount = undefined;
  }

  next();
});

export const CombPlan = model<ICombPlan>("CombPlan", CombPlanSchema);
