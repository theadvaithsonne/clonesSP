import { Schema, model } from "mongoose";

const ChannelMembershipSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    channelId: { type: Schema.Types.ObjectId, ref: "Channel", required: true },
    orgId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },

    // Membership details
    joinedAt: { type: Date, default: Date.now },
    role: { type: String, enum: ["member", "admin"], default: "member" },
    status: {
      type: String,
      enum: ["active", "inactive", "suspended"],
      default: "active",
    },

    // Payment tracking (for future use)
    subscriptionId: { type: String },
    subscriptionStatus: {
      type: String,
      enum: ["active", "cancelled", "expired"],
    },
    lastPaymentDate: { type: Date },
    nextPaymentDate: { type: Date },
    // Stamped when the user hits cancel. For recurring subs, `status`
    // stays "active" until the sweeper flips it at nextPaymentDate; for
    // free / one-time, `status` flips to "inactive" in the same request
    // that sets this timestamp.
    cancelledAt: { type: Date },

    // Activity
    lastActivityAt: { type: Date },

    // Posting permission (founder can mute users from posting/commenting)
    // Default true — all members can post. Set to false to mute.
    canPost: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Indexes
ChannelMembershipSchema.index({ userId: 1, orgId: 1 });
ChannelMembershipSchema.index({ channelId: 1, status: 1 });
ChannelMembershipSchema.index({ userId: 1, channelId: 1 }, { unique: true });
// Powers the expiry sweeper — hourly query filters on
// { subscriptionStatus: "cancelled", nextPaymentDate: { $lte: now } }.
ChannelMembershipSchema.index({ subscriptionStatus: 1, nextPaymentDate: 1 });

export const ChannelMembership = model(
  "ChannelMembership",
  ChannelMembershipSchema
);
