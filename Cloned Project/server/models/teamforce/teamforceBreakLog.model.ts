import { Schema, model, Types } from "mongoose";

const TeamforceBreakLogSchema = new Schema(
  {
    userId: { type: Types.ObjectId, ref: "User", required: true, index: true },
    orgId: { type: Types.ObjectId, ref: "Organization", required: true, index: true },
    timeTrackingId: { type: Types.ObjectId, ref: "TimeTracking" },
    breakStartTime: { type: Date, required: true },
    breakStopTime: { type: Date },
    durationInSeconds: { type: Number },
    withinBudgetSeconds: { type: Number, default: 0 },
    overBudgetSeconds: { type: Number, default: 0 },
    isBreach: { type: Boolean, default: false },
    triggeredBreach: { type: Boolean, default: false },
  },
  { timestamps: true }
);

TeamforceBreakLogSchema.index({ userId: 1, orgId: 1 });
TeamforceBreakLogSchema.index({ timeTrackingId: 1 });

export const TeamforceBreakLog = model(
  "TeamforceBreakLog",
  TeamforceBreakLogSchema
);
