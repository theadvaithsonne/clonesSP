import { Schema, model, Types } from "mongoose";

const DepartmentSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    color: { type: String, default: "" }, // optional for UI chips
  },
  { _id: false }
);

const FloorSchema = new Schema(
  {
    orgId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    level: { type: Number, required: true }, // 1,2,3... (order)
    name: { type: String, required: true, trim: true }, // e.g., "Floor 1"
    departments: { type: [DepartmentSchema], default: [] },
  },
  { timestamps: true }
);

FloorSchema.index({ orgId: 1, level: 1 }, { unique: true });

export const Floor = model("Floor", FloorSchema);
