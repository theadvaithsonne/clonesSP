import { Schema, model, Types } from "mongoose";

const LeaveRequestSchema = new Schema(
  {
    userId: { type: Types.ObjectId, ref: "User", required: true, index: true },
    orgId: { type: Types.ObjectId, ref: "Organization", required: true, index: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    reason: { type: String, required: true, trim: true, maxlength: 500 },
    status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending", index: true },
    approverId: { type: Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

LeaveRequestSchema.index({ userId: 1, orgId: 1 });
LeaveRequestSchema.index({ orgId: 1, status: 1 });

export const LeaveRequest = model("LeaveRequest", LeaveRequestSchema);
