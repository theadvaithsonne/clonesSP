import mongoose, { Schema, Document, Types } from "mongoose";

/**
 * StoreCouponCommission — cascading coupon rewards paid up the BUYER's
 * upline chain when a `Storefront/StoreProduct` (invoice itemType
 * `ecommerce_item`) is sold. Founders configure per-org rules; the
 * evaluator fires once per paid store invoice, walking
 * `User.ancestors[]` and granting the configured coupon to each level.
 *
 * Structure mirrors the affiliate/unilevel commission model:
 *   L1 = buyer's direct referrer ("the seller who shared the link")
 *   L2 = referrer's referrer
 *   ...
 *   LN = capped at MAX_LEVELS.
 *
 * How this differs from the existing `CouponRule`:
 *   - CouponRule grants the BUYER themselves after N purchases.
 *   - StoreCouponCommission grants the buyer's UPLINE, once per sale,
 *     with a distinct coupon per level.
 *
 * Reward coupons must be "unlimited" `PlatformCoupon`s — both
 * `maxUsageCount` AND `maxUsagePerUser` unset — so a single coupon can
 * be granted to many uplines over many sales without running dry.
 * Enforced at write time in the service; re-checked at evaluate time
 * so a coupon that gets capped after the rule was created just gets
 * skipped with a warn log rather than short-circuiting the whole
 * cascade.
 */

export const MAX_STORE_COMMISSION_LEVELS = 15;

/**
 * Same cap semantics as `CombPlanCapType` (see combPlan.model.ts) —
 * mirrored so both commission systems speak the same language:
 *   - "perpetual" — every eligible store purchase fires the cascade
 *     for every level's recipient (historical behaviour; the DEFAULT
 *     for every rule created before this field existed).
 *   - "per_pair_capped" — each level's recipient earns the grant on
 *     at most `capCount` distinct fires per unique buyer under this
 *     rule. Beyond the cap, the recipient's fire is silently skipped
 *     for THAT buyer; other buyers and other levels are unaffected.
 */
export type StoreCouponCommissionCapType = "perpetual" | "per_pair_capped";

export interface IStoreCouponCommissionLevel {
  /** 1-indexed. L1 = buyer's direct referrer. */
  level: number;
  couponId: Types.ObjectId;
  /** Uses granted to that level's earner per fire. Defaults to 1. */
  quantity: number;
}

export interface IStoreCouponCommission extends Document {
  _id: Types.ObjectId;
  orgId: Types.ObjectId;
  name: string;
  /**
   * Specific StoreProduct that triggers the cascade. Omit / null →
   * wildcard: every ecommerce_item sale on this org fires the rule.
   */
  triggerItemId?: Types.ObjectId;
  levels: IStoreCouponCommissionLevel[];
  isActive: boolean;
  /**
   * Only fires on invoices paid AFTER this timestamp. Defaults to
   * `createdAt` on insert. Never retro-fires — mirrors CouponRule's
   * `effectiveFrom` semantics.
   */
  effectiveFrom: Date;
  /**
   * Cap on how many times a specific (recipient, buyer) pair can fire
   * under this rule. Defaults to "perpetual"; legacy docs without the
   * field are treated as perpetual and skip the counter query entirely.
   */
  capType?: StoreCouponCommissionCapType;
  /** Only meaningful when capType === "per_pair_capped". Range 1..100. */
  capCount?: number;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const StoreCouponCommissionLevelSchema =
  new Schema<IStoreCouponCommissionLevel>(
    {
      level: { type: Number, required: true, min: 1, max: MAX_STORE_COMMISSION_LEVELS },
      couponId: {
        type: Schema.Types.ObjectId,
        ref: "PlatformCoupon",
        required: true,
      },
      quantity: { type: Number, required: true, min: 1, default: 1 },
    },
    { _id: false },
  );

const StoreCouponCommissionSchema = new Schema<IStoreCouponCommission>(
  {
    orgId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    triggerItemId: {
      type: Schema.Types.ObjectId,
      ref: "StoreProduct",
      index: true,
    },
    levels: {
      type: [StoreCouponCommissionLevelSchema],
      required: true,
      validate: {
        // Contiguous 1..N with no duplicates. Level 1 always required.
        validator: (arr: IStoreCouponCommissionLevel[]) => {
          if (!Array.isArray(arr) || arr.length === 0) return false;
          if (arr.length > MAX_STORE_COMMISSION_LEVELS) return false;
          const sorted = [...arr].sort((a, b) => a.level - b.level);
          for (let i = 0; i < sorted.length; i++) {
            if (sorted[i].level !== i + 1) return false;
          }
          return true;
        },
        message: `levels must be a contiguous 1..N sequence (min 1, max ${MAX_STORE_COMMISSION_LEVELS})`,
      },
    },
    isActive: { type: Boolean, default: true, index: true },
    effectiveFrom: { type: Date, required: true, default: () => new Date() },
    // Distribution cap — see StoreCouponCommissionCapType docs. Optional
    // so every pre-existing rule reads as "perpetual" without a
    // migration. `capCount` is validated conditionally in the pre-save
    // hook below.
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
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);

StoreCouponCommissionSchema.index({ orgId: 1, isActive: 1 });
StoreCouponCommissionSchema.index({ triggerItemId: 1, isActive: 1 });

// Cap-type consistency — mirrors combPlan.model.ts pre-save hook.
StoreCouponCommissionSchema.pre("save", function (next) {
  if (this.capType === "per_pair_capped") {
    if (typeof this.capCount !== "number" || this.capCount < 1) {
      return next(
        new Error(
          "capCount is required and must be ≥ 1 when capType is 'per_pair_capped'",
        ),
      );
    }
  } else {
    // Coerce anything non-per_pair_capped to a clean perpetual doc.
    this.capType = "perpetual";
    this.capCount = undefined;
  }
  next();
});

export const StoreCouponCommission = mongoose.model<IStoreCouponCommission>(
  "StoreCouponCommission",
  StoreCouponCommissionSchema,
);
