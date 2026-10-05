import { Schema, model, Types } from "mongoose";

const AvailabilitySchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  orgId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
  dayOfWeek: { type: Number, required: true, min: 0, max: 6 }, // 0 = Sunday, 6 = Saturday
  startTime: { type: String, required: true }, // "HH:mm" format, e.g., "09:00"
  endTime: { type: String, required: true }, // "HH:mm" format, e.g., "17:00"
  enabled: { type: Boolean, default: true },
}, { timestamps: true });

AvailabilitySchema.index({ userId: 1, orgId: 1, dayOfWeek: 1 }, { unique: true });

export const Availability = model("Availability", AvailabilitySchema);