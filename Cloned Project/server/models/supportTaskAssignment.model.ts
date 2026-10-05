import { Schema, model } from "mongoose";

/**
 * Who a support-chat Taskroom card was assigned to from the admin console
 * ("Assign to…"). Taskroom holds the real assignment; this is what the console
 * shows on the task note without a Taskroom round-trip per message. Covers both
 * kinds of support task — "Add to Taskroom" cards and mirrored tickets.
 */
const SupportTaskAssignmentSchema = new Schema(
  {
    groupId: { type: Schema.Types.ObjectId, ref: "Group", required: true, index: true },
    taskId: { type: String, required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, required: true },
    assignedBy: { type: String, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

SupportTaskAssignmentSchema.index({ groupId: 1, taskId: 1, userId: 1 }, { unique: true });

export const SupportTaskAssignment = model(
  "SupportTaskAssignment",
  SupportTaskAssignmentSchema,
  "support_task_assignments"
);
