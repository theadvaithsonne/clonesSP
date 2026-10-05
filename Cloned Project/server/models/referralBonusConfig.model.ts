import mongoose, { Schema, Document, Types } from "mongoose";

/**
 * Global signup referral bonus — a single platform-wide config row.
 *
 * When a user completes their profile and has a referrer, BOTH sides are paid
 * `amountUsd`: the referrer for bringing them, and the new user for arriving.
 * The money is debited from the platform's store wallet (Shorupan / Garage HQ)
 * and credited to each person's store wallet.
 *
 * Deliberately a singleton — `key` is unique and always "global" — rather than
 * a bare collection someone could accidentally end up with two of. Reading the
 * config is a `findOne({ key: "global" })` that cannot be ambiguous.
 *
 * Absent row = feature off. There is no implicit default amount: a bonus that
 * starts paying because a document was missing is the wrong failure direction.
 */

export interface IReferralBonusConfig extends Document {
  key: "global";
  /** Paid to EACH side, in USD. 0.10 means $0.10 to referrer AND $0.10 to referee. */
  amountUsd: number;
  isActive: boolean;
  updatedBy?: Types.ObjectId;
  updatedByEmail?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ReferralBonusConfigSchema = new Schema<IReferralBonusConfig>(
  {
    key: {
      type: String,
      enum: ["global"],
      default: "global",
      unique: true,
      required: true,
    },
    amountUsd: {
      type: Number,
      required: true,
      min: 0,
      // A sanity ceiling, not a business rule. This is paid on every referred
      // signup with no per-payout approval, so a mistyped 1000 would drain the
      // platform wallet before anyone noticed. Raise it deliberately if needed.
      max: 100,
      default: 0,
    },
    isActive: { type: Boolean, default: false },
    // Who last changed it. This moves real money on every signup, so "who set
    // it to that" needs to be answerable without digging through logs.
    updatedBy: { type: Schema.Types.ObjectId, ref: "GarageAdmin" },
    updatedByEmail: { type: String },
  },
  { timestamps: true, collection: "referralbonusconfigs" }
);

export const ReferralBonusConfig =
  mongoose.models.ReferralBonusConfig ||
  mongoose.model<IReferralBonusConfig>(
    "ReferralBonusConfig",
    ReferralBonusConfigSchema
  );
