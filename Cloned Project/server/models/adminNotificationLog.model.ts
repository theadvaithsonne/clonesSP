// One row per (rule, event) an admin notification rule matched.
//
// Two jobs. It is the AUDIT — "why did this person get mailed?" has an answer.
// And it is the IDEMPOTENCY LOCK: the unique (ruleId, eventId) index means the
// row is written BEFORE any mail goes out, so a retry, a double emit, or a
// delayed autodebit re-check firing after the first check already sent can
// only ever produce one email per rule per event. A duplicate-key error on
// insert is the signal "already handled", not a failure.
import mongoose, { Schema, Document, Types } from "mongoose";

export type AdminNotificationLogStatus =
  | "queued"
  | "sent"
  | "failed"
  | "skipped_throttle"
  | "skipped_no_recipients";

export interface IAdminNotificationLog extends Document {
  ruleId: Types.ObjectId;
  ruleName: string;
  eventName: string;
  eventId: string;
  recipients: string[];
  status: AdminNotificationLogStatus;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

const AdminNotificationLogSchema = new Schema<IAdminNotificationLog>(
  {
    ruleId: { type: Schema.Types.ObjectId, ref: "AdminNotificationRule", required: true },
    // Denormalised so the log still reads sensibly after a rule is deleted.
    ruleName: { type: String, required: true },
    eventName: { type: String, required: true, index: true },
    eventId: { type: String, required: true },
    recipients: { type: [String], default: [] },
    status: {
      type: String,
      enum: ["queued", "sent", "failed", "skipped_throttle", "skipped_no_recipients"],
      default: "queued",
    },
    error: { type: String },
  },
  { timestamps: true },
);

AdminNotificationLogSchema.index({ ruleId: 1, eventId: 1 }, { unique: true });
// Throttle lookup: "how many has this rule sent in the last hour?"
AdminNotificationLogSchema.index({ ruleId: 1, status: 1, createdAt: -1 });

export const AdminNotificationLog = mongoose.model<IAdminNotificationLog>(
  "AdminNotificationLog",
  AdminNotificationLogSchema,
);
