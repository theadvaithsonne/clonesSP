import { Schema, model } from "mongoose";

const TeamforceBranchSchema = new Schema(
  {
    orgId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
    name: { type: String, required: true, trim: true },
    code: { type: String, trim: true },
    address: { type: String },
    city: { type: String },
    state: { type: String },
    country: { type: String },
    postalCode: { type: String },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

TeamforceBranchSchema.index({ orgId: 1, name: 1 }, { unique: true });
TeamforceBranchSchema.index({ orgId: 1 });

export const TeamforceBranch = model(
  "TeamforceBranch",
  TeamforceBranchSchema
);
