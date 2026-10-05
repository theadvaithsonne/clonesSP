import { Schema, model, Types } from "mongoose";

const TimeTrackingSchema = new Schema(
  {
    userId: { type: Types.ObjectId, ref: "User", required: true, index: true },
    orgId: { type: Types.ObjectId, ref: "Organization", required: true, index: true },
    clockInTime: { type: Date, required: true },
    clockOutTime: { type: Date },
    durationInSeconds: { type: Number },
  },
  { timestamps: true }
);

TimeTrackingSchema.index({ userId: 1, orgId: 1 });

export const TimeTracking = model("TimeTracking", TimeTrackingSchema);
