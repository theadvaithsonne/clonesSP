import { Schema, model, Types } from "mongoose";

const TeamforcePayrollConfigSchema = new Schema(
  {
    orgId: {
      type: Types.ObjectId,
      ref: "Organization",
      required: true,
      unique: true,
    },
    attendanceCutoffDay: {
      type: Number,
      required: true,
      default: 1,
      min: 1,
      max: 28,
    },
    defaultState: { type: String, default: "Karnataka", trim: true },
    fyStartMonth: { type: Number, default: 4, min: 1, max: 12 },
    locked: { type: Boolean, default: false },
    lockedSince: { type: Date, default: null },
  },
  { timestamps: true }
);

export const TeamforcePayrollConfig = model(
  "TeamforcePayrollConfig",
  TeamforcePayrollConfigSchema
);
