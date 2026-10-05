import mongoose, { Schema, Document, Types } from "mongoose";

/**
 * One row per referred signup that was paid out.
 *
 * `refereeUserId` is UNIQUE — that index is the idempotency guarantee, not a
 * convenience. The payout hook runs on profile completion, which a user can
 * trigger repeatedly by editing their profile; without the unique index every
 * edit would pay another $0.10 pair out of the platform wallet.
 *
 * Also the audit trail: the amount is snapshotted per payout, so changing the
 * global config later never rewrites what someone was actually paid.
 */

export interface IReferralBonusPayout extends Document {
  refereeUserId: Types.ObjectId;
  referrerUserId: Types.ObjectId;
  /** Snapshot of config.amountUsd at payout time — paid to EACH side. */
  amountUsd: number;
  /** amountUsd × 2, debited from the platform store wallet. */
  totalDebitedUsd: number;
  refereeOrgId: Types.ObjectId;
  referrerOrgId: Types.ObjectId;
  refereeTransactionId?: Types.ObjectId;
  referrerTransactionId?: Types.ObjectId;
  platformTransactionId?: Types.ObjectId;
  /**
   * When each side's notification actually went out. Null means the payout
   * committed but the email did not — a state that is otherwise invisible,
   * since a send failure must never roll back money that has already moved.
   */
  referrerEmailedAt?: Date;
  refereeEmailedAt?: Date;
  /**
   * Set when the payout was clawed back — currently only when the referred
   * account is merged into a pre-existing one, which would otherwise let the
   * same person earn a referrer $0.10 per throwaway signup, repeatedly.
   */
  reversedAt?: Date;
  reversedReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ReferralBonusPayoutSchema = new Schema<IReferralBonusPayout>(
  {
    refereeUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    referrerUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    amountUsd: { type: Number, required: true },
    totalDebitedUsd: { type: Number, required: true },
    refereeOrgId: { type: Schema.Types.ObjectId, ref: "Organization" },
    referrerOrgId: { type: Schema.Types.ObjectId, ref: "Organization" },
    refereeTransactionId: { type: Schema.Types.ObjectId },
    referrerTransactionId: { type: Schema.Types.ObjectId },
    platformTransactionId: { type: Schema.Types.ObjectId },
    referrerEmailedAt: { type: Date },
    refereeEmailedAt: { type: Date },
    reversedAt: { type: Date },
    reversedReason: { type: String },
  },
  { timestamps: true, collection: "referralbonuspayouts" }
);

ReferralBonusPayoutSchema.index({ createdAt: -1 });

export const ReferralBonusPayout =
  mongoose.models.ReferralBonusPayout ||
  mongoose.model<IReferralBonusPayout>(
    "ReferralBonusPayout",
    ReferralBonusPayoutSchema
  );
