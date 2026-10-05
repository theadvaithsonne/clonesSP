import { Schema, model, Types } from "mongoose";

export const LEAVE_TYPES = [
  "Casual Leave",
  "Sick Leave",
  "Earned Leave",
  "Official Duty",
] as const;

export const LEAVE_STATUSES = [
  "Pending",
  "Approved",
  "Rejected",
  "Cancelled",
] as const;

/** Where a leave request is routed for approval — set at submission time
 *  based on the requester's role:
 *  - "user": a specific person must approve (admin's reporting manager).
 *  - "admin_or_founder": any teamforce admin or founder of the org.
 *  - "founder_only": only a founder of the org (covers founder self-approval
 *    and admins without a reporting manager). */
export const APPROVER_SCOPES = [
  "user",
  "admin_or_founder",
  "founder_only",
] as const;
export type ApproverScope = (typeof APPROVER_SCOPES)[number];

const TeamforceLeaveRequestSchema = new Schema(
  {
    userId: { type: Types.ObjectId, ref: "User", required: true, index: true },
    orgId: { type: Types.ObjectId, ref: "Organization", required: true, index: true },
    leaveType: { type: String, enum: LEAVE_TYPES, required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    isHalfDay: { type: Boolean, default: false },
    reason: { type: String, required: true, trim: true },
    attachmentUrl: { type: String, trim: true },
    status: {
      type: String,
      enum: LEAVE_STATUSES,
      default: "Pending",
      index: true,
    },
    approverUserId: { type: Types.ObjectId, ref: "User" },
    approverName: { type: String, trim: true },
    decisionNote: { type: String, trim: true },
    decidedAt: { type: Date },

    // Routing — computed and persisted at submission time. See
    // APPROVER_SCOPES above. `assignedApproverUserId` is only set when
    // `approverScope === "user"` (the admin's reporting manager).
    approverScope: { type: String, enum: APPROVER_SCOPES, index: true },
    assignedApproverUserId: { type: Types.ObjectId, ref: "User", index: true },
  },
  { timestamps: true }
);

TeamforceLeaveRequestSchema.index({ orgId: 1, status: 1, createdAt: -1 });
TeamforceLeaveRequestSchema.index({ userId: 1, orgId: 1, createdAt: -1 });

export const TeamforceLeaveRequest = model(
  "TeamforceLeaveRequest",
  TeamforceLeaveRequestSchema
);
