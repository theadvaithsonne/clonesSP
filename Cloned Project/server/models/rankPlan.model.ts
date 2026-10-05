// src/models/rankPlan.model.ts
//
// Versioned configuration for the NetworkChain rank bonus plan.
//
// Versioned rather than a single mutable document so a past payout always
// explains itself: every RankRun stamps the `version` it used, and changing the
// numbers later never rewrites history. Exactly one version is `isActive` at a
// time; a change means inserting a new version and deactivating the old one.
//
// Amounts are DOLLARS (float), matching the wallet layer — see
// models/walletTransaction.model.ts. Store 40, not 4000.

import mongoose, { Schema, Document, Types } from "mongoose";

/** Ordered low → high. Index in this array IS the rank ordinal. */
export const RANK_KEYS = [
  "Bronze",
  "Silver",
  "Gold",
  "Diamond",
  "Platinum",
] as const;
export type RankKey = (typeof RANK_KEYS)[number];

export interface IRankTier {
  key: RankKey;
  /** Bonus for holding THIS rank as your top rank, excluding the stacked Bronze. */
  bonusUsd: number;
  /**
   * Bronze only: how many DIRECT referrals must hold an active paid
   * subscription. Ignored for every other rank.
   */
  requiredActiveDirects?: number;
  /**
   * Silver and above: how many DISTINCT LEGS must each contain at least one
   * holder of the rank immediately below. Ignored for Bronze.
   */
  requiredLegs?: number;
}

export interface IRankPlan extends Document {
  version: number;
  isActive: boolean;
  /** Which partner's subscriptions count. NetworkChain only, per the spec. */
  thirdPartyClientId: Types.ObjectId;
  tiers: IRankTier[];
  /**
   * When true, every rank holder also draws the Bronze bonus on top of their
   * top-rank bonus (Silver pays 40+200=240). Higher ranks never stack with each
   * other. This is the confirmed rule; the flag exists so the behaviour is
   * explicit in config rather than buried in the payout code.
   */
  bronzeStacks: boolean;
  note?: string;
  createdAt: Date;
  updatedAt: Date;
}

const RankTierSchema = new Schema<IRankTier>(
  {
    key: { type: String, enum: RANK_KEYS as unknown as string[], required: true },
    bonusUsd: { type: Number, required: true, min: 0 },
    requiredActiveDirects: { type: Number, min: 1 },
    requiredLegs: { type: Number, min: 1 },
  },
  { _id: false }
);

const RankPlanSchema = new Schema<IRankPlan>(
  {
    version: { type: Number, required: true, unique: true },
    isActive: { type: Boolean, default: false, index: true },
    thirdPartyClientId: { type: Schema.Types.ObjectId, required: true },
    tiers: {
      type: [RankTierSchema],
      required: true,
      validate: {
        validator: function (tiers: IRankTier[]) {
          if (!tiers || tiers.length !== RANK_KEYS.length) return false;
          // Must be every rank, in ascending order — the qualification pass
          // relies on array index being the rank ordinal.
          for (let i = 0; i < RANK_KEYS.length; i++) {
            if (tiers[i].key !== RANK_KEYS[i]) return false;
          }
          // Bronze is the only rank defined by direct count; the rest by legs.
          if (!tiers[0].requiredActiveDirects) return false;
          for (let i = 1; i < tiers.length; i++) {
            if (!tiers[i].requiredLegs) return false;
          }
          return true;
        },
        message:
          "tiers must list all five ranks in ascending order; Bronze needs requiredActiveDirects, every higher rank needs requiredLegs",
      },
    },
    bronzeStacks: { type: Boolean, default: true },
    note: { type: String, maxlength: 500 },
  },
  { timestamps: true }
);

// At most one active plan. Partial index so deactivated versions don't collide.
RankPlanSchema.index(
  { isActive: 1 },
  { unique: true, partialFilterExpression: { isActive: true } }
);

export const RankPlan = mongoose.model<IRankPlan>("RankPlan", RankPlanSchema);

/** Total paid to a holder of `key`, including the stacked Bronze. */
export function payoutFor(plan: IRankPlan, key: RankKey): number {
  const tier = plan.tiers.find((t) => t.key === key);
  if (!tier) return 0;
  if (key === "Bronze" || !plan.bronzeStacks) return tier.bonusUsd;
  const bronze = plan.tiers.find((t) => t.key === "Bronze");
  return Math.round((tier.bonusUsd + (bronze?.bonusUsd || 0)) * 100) / 100;
}
