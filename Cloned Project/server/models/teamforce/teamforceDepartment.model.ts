import { Schema, model } from "mongoose";

const TeamforceDepartmentSchema = new Schema(
  {
    orgId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
    name: { type: String, required: true, trim: true },
    description: { type: String },
    headId: { type: Schema.Types.ObjectId, ref: "User" },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

TeamforceDepartmentSchema.index({ orgId: 1, name: 1 }, { unique: true });
TeamforceDepartmentSchema.index({ orgId: 1 });

export const TeamforceDepartment = model(
  "TeamforceDepartment",
  TeamforceDepartmentSchema
);
