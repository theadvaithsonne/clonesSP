import { Schema, model } from "mongoose";

const TeamforceShiftSchema = new Schema(
  {
    orgId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
    name: { type: String, required: true, trim: true },
    startTime: { type: String, required: true }, // HH:mm
    endTime: { type: String, required: true }, // HH:mm
    workingHours: { type: Number, default: 0 }, // total working hours in shift
    graceMinutes: { type: Number, default: 0 }, // grace period (mins) for late arrival
    breakMinutes: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

TeamforceShiftSchema.index({ orgId: 1 });

export const TeamforceShift = model("TeamforceShift", TeamforceShiftSchema);
