import { Schema, model, Types } from "mongoose";

// MissedCall — WhatsApp-style record of an unanswered incoming call.
//
// Today only the workspace knock-knock flow ("someone rang you, you
// didn't answer in 45s") writes these. Other call surfaces (1-on-1
// bookings, conference rooms) intentionally don't generate missed
// calls — those are scheduled / opt-in flows where "didn't show up"
// has a different meaning. The `kind` field is a forward-compat lever
// for adding more sources later without migration.
//
// A row is created when the knock auto-expires (see expireKnock in
// src/realtime/socket.ts). Decline is excluded — declining is an
// intentional action by the recipient, not a miss.
//
// `viewedAt` flips when the recipient opens the missed-calls list
// (clears the badge). `dismissedAt` is for explicit dismiss; rows
// stay queryable but filter out of the default list. We don't delete
// for history reasons.
export interface IMissedCall {
  _id: Types.ObjectId;
  toUserId: Types.ObjectId;
  fromUserId: Types.ObjectId;
  // The org the recipient was active in when the knock was placed.
  // Optional because some knocks are cross-org (a global DM contact
  // ringing you while you're on a different org's surface).
  orgId?: Types.ObjectId;
  kind: "knock";
  // Friendly snapshot of the caller's name + avatar at the time of
  // the miss. Saves a populate hop on every list read, and keeps the
  // entry meaningful even if the caller later changes their name.
  fromName?: string;
  fromAvatar?: string;
  occurredAt: Date;
  viewedAt: Date | null;
  dismissedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const MissedCallSchema = new Schema<IMissedCall>(
  {
    toUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    fromUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    orgId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: false,
      index: { sparse: true },
    },
    kind: {
      type: String,
      enum: ["knock"],
      default: "knock",
      required: true,
    },
    fromName: { type: String, trim: true },
    fromAvatar: { type: String, trim: true },
    occurredAt: { type: Date, required: true, default: Date.now },
    viewedAt: { type: Date, default: null },
    dismissedAt: { type: Date, default: null, index: { sparse: true } },
  },
  { timestamps: true },
);

// Hot path: the mobile + web headers fetch unviewed-count for the
// badge on every poll. (toUserId, viewedAt, dismissedAt) covers
// the badge query exactly.
MissedCallSchema.index({ toUserId: 1, viewedAt: 1, dismissedAt: 1 });
// List view sorts newest-first by recipient.
MissedCallSchema.index({ toUserId: 1, occurredAt: -1 });

export const MissedCall = model<IMissedCall>("MissedCall", MissedCallSchema);
