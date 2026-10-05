import { Schema, model, Types } from "mongoose";

// One approver's slice of an approval request. Stored as a subdocument so
// reading "did Alice decide?" is a single document read without a join.
const ApproverSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    decidedAt: { type: Date },
    comment: { type: String, trim: true, maxlength: 500 },
  },
  { _id: false }
);

const ApprovalSchema = new Schema(
  {
    orgId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    requesterId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, trim: true, maxlength: 1000 },
    deadline: { type: Date },
    // Parallel = any rejection fails, all approvals pass. Sequential is not
    // implemented yet; the field exists so the schema stays forward-compatible.
    approvalType: {
      type: String,
      enum: ["parallel", "sequential"],
      default: "parallel",
    },
    approvers: { type: [ApproverSchema], default: [] },
    overallStatus: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
      index: true,
    },
  },
  { timestamps: true }
);

// Approver lookup: "what's still waiting on me?"
ApprovalSchema.index({ "approvers.userId": 1, overallStatus: 1 });

export const Approval = model("Approval", ApprovalSchema);
