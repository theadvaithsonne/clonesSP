import { Schema, model, Types } from "mongoose";

export const LEAVE_POLICY_TYPES = ["Paid", "Unpaid"] as const;
export const LEAVE_POLICY_APPLICABLE = [
  "All Employees",
  "Full-Time Only",
  "Contract Only",
] as const;

const TeamforceLeavePolicySchema = new Schema(
  {
    orgId: {
      type: Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    leaveType: { type: String, enum: LEAVE_POLICY_TYPES, required: true },
    annualQuota: { type: Number, default: 0 },
    maxConsecutiveDays: { type: Number, default: 0 },
    applicableFor: {
      type: String,
      enum: LEAVE_POLICY_APPLICABLE,
      default: "All Employees",
    },
    allowCarryForward: { type: Boolean, default: false },
    allowEncashment: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

TeamforceLeavePolicySchema.index({ orgId: 1, isActive: 1, name: 1 });

export const TeamforceLeavePolicy = model(
  "TeamforceLeavePolicy",
  TeamforceLeavePolicySchema
);
