// src/models/jobReward.model.ts
//
// The referral reward owed for one hire. Created when the founder confirms a
// hire whose application came through a referral link; paid out through the
// existing Unilevel Plus distribution once the guarantee period ends.
//
//   in_guarantee → processing → paid
//                             ↘ payment_due (founder's wallet could not cover an
//                                            "on hire" reward; retried later)
//   in_guarantee → cancelled   (hire left early — reserved funds go back)
//   paid         → refund_due  (hire left after payout; settled manually)
//
// `processing` is the claim a sweeper takes before touching money, so two
// sweepers (or a sweeper and a manual retry) can never pay the same reward.

import { Schema, model, Document, Types } from "mongoose";

export const REWARD_STATUSES = [
  "in_guarantee",
  "processing",
  "paid",
  "payment_due",
  "cancelled",
  "refund_due",
  "failed",
] as const;
export type RewardStatus = (typeof REWARD_STATUSES)[number];

export interface IJobReward extends Document {
  _id: Types.ObjectId;
  orgId: Types.ObjectId;
  jobId: Types.ObjectId;
  applicationId: Types.ObjectId;
  candidateId: Types.ObjectId;
  /** Whose GaragePay wallet funds the reward. */
  payerId: Types.ObjectId;
  referrerId: Types.ObjectId;
  amount: number;
  currency: "USD";
  funding: "hold" | "on_hire";
  status: RewardStatus;
  joinedAt: Date;
  guaranteeDays: number;
  guaranteeEndsAt: Date;
  paidAt?: Date;
  /** What the network actually earned — the rest went back to the payer. */
  paidAmount?: number;
  returnedAmount?: number;
  distributionId?: string;
  cancelledAt?: Date;
  cancelReason?: string;
  lastError?: string;
  attempts: number;
  createdAt: Date;
  updatedAt: Date;
}

const JobRewardSchema = new Schema<IJobReward>(
  {
    orgId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    jobId: { type: Schema.Types.ObjectId, ref: "JobPosting", required: true },
    applicationId: {
      type: Schema.Types.ObjectId,
      ref: "JobApplication",
      required: true,
    },
    candidateId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    payerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    referrerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "USD" },
    funding: { type: String, enum: ["hold", "on_hire"], required: true },
    status: { type: String, enum: REWARD_STATUSES, default: "in_guarantee" },
    joinedAt: { type: Date, required: true },
    guaranteeDays: { type: Number, required: true },
    guaranteeEndsAt: { type: Date, required: true },
    paidAt: { type: Date },
    paidAmount: { type: Number },
    returnedAmount: { type: Number },
    distributionId: { type: String },
    cancelledAt: { type: Date },
    cancelReason: { type: String, maxlength: 500 },
    lastError: { type: String, maxlength: 1000 },
    attempts: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// One reward per hire.
JobRewardSchema.index({ applicationId: 1 }, { unique: true });
JobRewardSchema.index({ orgId: 1, status: 1, createdAt: -1 });
JobRewardSchema.index({ status: 1, guaranteeEndsAt: 1 });
JobRewardSchema.index({ referrerId: 1, createdAt: -1 });

export const JobReward = model<IJobReward>("JobReward", JobRewardSchema);
