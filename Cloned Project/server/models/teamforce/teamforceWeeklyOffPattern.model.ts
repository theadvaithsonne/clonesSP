import { Schema, model } from "mongoose";

const TeamforceWeeklyOffPatternSchema = new Schema(
  {
    orgId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
    name: { type: String, required: true, trim: true },
    patternType: {
      type: String,
      enum: ["Fixed", "Rotating"],
      default: "Fixed",
    },
    offDays: {
      type: [Number], // 0=Sunday, 1=Monday, ... 6=Saturday
      default: [],
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

TeamforceWeeklyOffPatternSchema.index({ orgId: 1 });

export const TeamforceWeeklyOffPattern = model(
  "TeamforceWeeklyOffPattern",
  TeamforceWeeklyOffPatternSchema
);
