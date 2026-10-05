import mongoose, { Schema, Document, Types } from "mongoose";

/**
 * Per-(user, rule) progress snapshot. Tracks how much qualifying purchase
 * the user has accumulated against this rule, and how many times the rule
 * has fired for them. Avoids replaying invoice history every evaluation.
 */
export interface ICouponRuleProgress extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  ruleId: Types.ObjectId;
  /** Cumulative qualifying quantity since the rule became effective. */
  purchaseCount: number;
  /** How many times the rule has granted to this user. */
  firedTimes: number;
  lastFiredAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const CouponRuleProgressSchema = new Schema<ICouponRuleProgress>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    ruleId: {
      type: Schema.Types.ObjectId,
      ref: "CouponRule",
      required: true,
      index: true,
    },
    purchaseCount: { type: Number, default: 0, min: 0 },
    firedTimes: { type: Number, default: 0, min: 0 },
    lastFiredAt: { type: Date },
  },
  { timestamps: true }
);

// One progress row per user × rule.
CouponRuleProgressSchema.index({ userId: 1, ruleId: 1 }, { unique: true });

export const CouponRuleProgress = mongoose.model<ICouponRuleProgress>(
  "CouponRuleProgress",
  CouponRuleProgressSchema
);
