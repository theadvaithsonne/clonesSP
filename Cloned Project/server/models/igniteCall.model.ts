import mongoose, { Schema, Document, Types } from "mongoose";

/**
 * An affiliate's Ignite call — the link between a Garage user and a
 * NetworkChains catch-up (a MeetSchedule in contacts-backend).
 *
 * `title` and `scheduledAt` are SNAPSHOTS. They let the admin table, the
 * history list and CSV export render when contacts-backend is unreachable,
 * and they keep history readable if the schedule is later deleted in NC.
 *
 * The four-state status is NOT stored — it is derived at read time from the
 * catch-up's live state. See services/igniteCall.service.ts.
 */
export interface IIgniteCall extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  adminId: Types.ObjectId;
  ncHostUserId: string;
  ncScheduleId: string;
  ncRoomId: string;
  title: string;
  scheduledAt: Date;
  detachedAt?: Date | null;
  /**
   * Set when an operator marks the call complete BY HAND.
   *
   * Status is otherwise derived from the live catch-up, which cannot see a
   * call that happened off-platform, was joined from a phone that never
   * stamped a session, or whose room state was lost. This override wins over
   * the derived value, and is kept as its own field rather than writing
   * `status` so the derived truth stays visible underneath it.
   */
  manuallyCompletedAt?: Date | null;
  manuallyCompletedBy?: Types.ObjectId;
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const IgniteCallSchema = new Schema<IIgniteCall>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    adminId: { type: Schema.Types.ObjectId, ref: "GarageAdmin", required: true },
    ncHostUserId: { type: String, required: true },
    ncScheduleId: { type: String, required: true },
    ncRoomId: { type: String, required: true },
    title: { type: String, required: true },
    scheduledAt: { type: Date, required: true },
    detachedAt: { type: Date, default: null },
    manuallyCompletedAt: { type: Date, default: null },
    manuallyCompletedBy: { type: Schema.Types.ObjectId, ref: "GarageAdmin" },
    createdBy: { type: Schema.Types.ObjectId, ref: "GarageAdmin" },
  },
  { timestamps: true },
);

// The per-row lookup: newest live call for a set of affiliates.
IgniteCallSchema.index({ userId: 1, detachedAt: 1, scheduledAt: -1 });
// The same catch-up must not be attached to the same affiliate twice.
IgniteCallSchema.index({ userId: 1, ncScheduleId: 1 }, { unique: true });

export const IgniteCallModel = mongoose.model<IIgniteCall>("IgniteCall", IgniteCallSchema);
