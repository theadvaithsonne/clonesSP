import { Schema, model, Types } from "mongoose";

/**
 * "Ask an eligible person to give layaway on my behalf" — a genuine
 * 3-party record (requester / eligible person being asked / recipient
 * the coins should go to), which is why this is its own model rather than
 * reusing bat246PlacementNotifications.model.ts (that model's required
 * fields are shaped for a different, 2-party concept). The notification
 * bell just points at this record via its new layawayRequestId field —
 * same relationship "placement" notifications already have to real
 * placement data elsewhere in this subsystem.
 */
const Bat246LayawayRequestSchema = new Schema(
  {
    requestedByUserId: { type: Types.ObjectId, ref: "User", required: true, index: true },
    eligibleUserId: { type: Types.ObjectId, ref: "User", required: true, index: true },
    recipientUserId: { type: Types.ObjectId, ref: "User", required: true },
    amount: { type: Number, required: true, min: 0 },
    productId: { type: Types.ObjectId, ref: "Product", default: null },
    note: { type: String, default: "" },
    // "cancelled" — the requester backed out while it was still pending
    // (see cancelLayawayRequest in bat246Layaway.service.ts). Distinct from
    // "denied" (the eligible person said no) so the requester's own
    // request-tracking view can tell "I changed my mind" apart from
    // "they said no" at a glance.
    status: {
      type: String,
      enum: ["pending", "approved", "denied", "insufficient_at_approval", "cancelled"],
      default: "pending",
      index: true,
    },
    respondedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

Bat246LayawayRequestSchema.index({ eligibleUserId: 1, status: 1 });

export const Bat246LayawayRequest = model("bat246LayawayRequests", Bat246LayawayRequestSchema);
